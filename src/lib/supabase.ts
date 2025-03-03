import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Por favor, configura las variables de entorno VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY. ' +
    'Haz clic en el botón "Connect to Supabase" en la parte superior derecha para obtener las credenciales.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Question = {
  id: string;
  text: string;
  type: 'text' | 'select';
  options?: string[];
  created_at: string;
};

export type Answer = {
  id: string;
  question_id: string;
  user_id: string;
  answer_text: string;
  created_at: string;
};

export type Profile = {
  id: string;
  email: string;
  role: 'admin' | 'user';
};

// Helper function to check if a user exists and create one if needed
export const createUserIfNotExists = async (email: string, password: string, isAdmin: boolean = false) => {
  try {
    // Check if user exists
    const { data: { user }, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (signInError) {
      if (signInError.message.includes('Invalid login credentials')) {
        // User doesn't exist, create one
        if (password.length < 6) {
          return { success: false, message: 'La contraseña debe tener al menos 6 caracteres' };
        }
        
        const { data: { user: newUser }, error: signUpError } = await supabase.auth.signUp({
          email,
          password
        });

        if (signUpError) {
          if (signUpError.message.includes('already registered')) {
            return { success: false, message: 'El correo electrónico ya está registrado pero la contraseña es incorrecta' };
          }
          return { success: false, message: signUpError.message };
        }

        if (newUser) {
          // Wait a moment for the trigger to create the profile
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Check if profile exists, create or update if needed
          try {
            const { data: existingProfile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', newUser.id)
              .maybeSingle();
              
            if (!existingProfile) {
              // Profile wasn't created by trigger, create it manually with ON CONFLICT DO NOTHING
              const { error: insertError } = await supabase
                .from('profiles')
                .upsert([{ 
                  id: newUser.id, 
                  email: email, 
                  role: isAdmin ? 'admin' : 'user' 
                }], { onConflict: 'id' });
                
              if (insertError) {
                console.error("Error creating profile manually:", insertError);
                return { success: false, message: 'Error al crear el perfil' };
              }
            } else if (isAdmin && existingProfile.role !== 'admin') {
              // Profile exists but needs to be updated to admin
              const { error: updateError } = await supabase
                .from('profiles')
                .update({ role: 'admin' })
                .eq('id', newUser.id);

              if (updateError) {
                console.error("Error updating profile to admin:", updateError);
                return { success: false, message: 'Error al actualizar el perfil a administrador' };
              }
            }
          } catch (profileError) {
            console.error("Error handling profile creation:", profileError);
            return { success: false, message: 'Error al manejar la creación del perfil' };
          }
        }

        return { success: true, message: 'Usuario creado exitosamente', user: newUser };
      } else {
        return { success: false, message: signInError.message };
      }
    }

    if (user && isAdmin) {
      // Update existing user to admin if requested
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ role: 'admin' })
        .eq('id', user.id);

      if (updateError) {
        console.error("Error updating profile to admin:", updateError);
        return { success: false, message: 'Error al actualizar el perfil a administrador' };
      }
      
      return { success: true, message: 'Usuario actualizado a administrador', user };
    }

    return { success: true, message: 'Usuario ya existe', user };
  } catch (error: any) {
    console.error('Error creating user:', error);
    return { success: false, message: 'Error al crear usuario: ' + (error.message || 'Error desconocido'), error };
  }
};