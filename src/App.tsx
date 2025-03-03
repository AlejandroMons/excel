import React, { useState, useEffect } from 'react';
import { Shield, ClipboardList, LogOut, Plus, Save, Trash2, UserPlus, KeyRound } from 'lucide-react';
import { supabase, type Question, type Answer, type Profile, createUserIfNotExists } from './lib/supabase';
import toast, { Toaster } from 'react-hot-toast';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<Profile | null>(null);
  const [activeView, setActiveView] = useState<'login' | 'questions' | 'admin' | 'register' | 'resetPassword'>('login');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [newQuestion, setNewQuestion] = useState({
    text: '',
    type: 'text' as const,
    options: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    checkUser();
    fetchQuestions();
  }, []);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      try {
        // Check if profile exists
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        if (error) {
          console.error("Error fetching profile:", error);
          return;
        }

        if (profile) {
          setUser(profile);
          setIsAuthenticated(true);
          setActiveView('questions');
        } else {
          // Profile doesn't exist, create it manually with upsert
          const { error: upsertError } = await supabase
            .from('profiles')
            .upsert([{ 
              id: session.user.id, 
              email: session.user.email || '', 
              role: 'user' 
            }], { onConflict: 'id' });
            
          if (upsertError) {
            console.error("Error creating profile manually:", upsertError);
            return;
          }
          
          // Fetch the profile again
          const { data: newProfile, error: fetchError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();
            
          if (fetchError) {
            console.error("Error fetching new profile:", fetchError);
            return;
          }
          
          if (newProfile) {
            setUser(newProfile);
            setIsAuthenticated(true);
            setActiveView('questions');
          } else {
            console.error("Failed to create or fetch profile");
          }
        }
      } catch (error) {
        console.error("Error in checkUser:", error);
      }
    }
  };

  const fetchQuestions = async () => {
    try {
      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error("Supabase request failed", error);
        // Don't show error toast during initial load as tables might not exist yet
        if (error.message.includes("does not exist") && isAuthenticated) {
          toast.error('Error: Las tablas de la base de datos no existen. Por favor, ejecuta las migraciones.');
        }
        return;
      }
      
      setQuestions(data || []);
    } catch (error) {
      console.error("Error fetching questions:", error);
    }
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error('Correo electrónico o contraseña incorrectos');
        } else {
          toast.error(error.message || 'Error al iniciar sesión');
        }
        setIsLoading(false);
        return;
      }

      if (data.user) {
        // Check if profile exists, create if it doesn't using upsert
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();

        if (profileError) {
          console.error("Error fetching profile:", profileError);
          toast.error('Error al cargar el perfil');
          setIsLoading(false);
          return;
        }

        if (!profile) {
          // Create profile manually with upsert
          const { error: upsertError } = await supabase
            .from('profiles')
            .upsert([{ 
              id: data.user.id, 
              email: data.user.email || '', 
              role: 'user' 
            }], { onConflict: 'id' });
            
          if (upsertError) {
            console.error("Error creating profile manually:", upsertError);
            toast.error('Error al crear el perfil');
            setIsLoading(false);
            return;
          }
          
          // Fetch the newly created profile
          const { data: newProfile, error: fetchError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .maybeSingle();
            
          if (fetchError || !newProfile) {
            console.error("Error fetching new profile:", fetchError);
            toast.error('Error al cargar el perfil');
            setIsLoading(false);
            return;
          }
          
          setUser(newProfile);
        } else {
          setUser(profile);
        }
        
        setIsAuthenticated(true);
        setActiveView('questions');
        toast.success('¡Bienvenido!');
      }
    } catch (error: any) {
      console.error("Login error:", error);
      toast.error('Error inesperado al iniciar sesión');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;
    
    if (password !== confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password
      });

      if (error) {
        if (error.message.includes('already registered')) {
          toast.error('Este correo electrónico ya está registrado');
        } else if (error.message.includes('password')) {
          toast.error('La contraseña debe tener al menos 6 caracteres');
        } else {
          toast.error(error.message || 'Error al registrarse');
        }
        setIsLoading(false);
        return;
      }

      if (data.user) {
        // Create profile manually with upsert to ensure it exists
        const { error: upsertError } = await supabase
          .from('profiles')
          .upsert([{ 
            id: data.user.id, 
            email: email, 
            role: 'user' 
          }], { onConflict: 'id' });
          
        if (upsertError) {
          console.error("Error creating profile during registration:", upsertError);
          // Continue anyway, as this is just a registration
        }
      }

      toast.success('Registro exitoso. Ya puedes iniciar sesión.');
      setActiveView('login');
    } catch (error: any) {
      console.error("Registration error:", error);
      toast.error('Error inesperado al registrarse');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: window.location.origin,
      });

      if (error) {
        toast.error(error.message || 'Error al enviar el correo de recuperación');
        setIsLoading(false);
        return;
      }

      setResetSent(true);
      toast.success('Se ha enviado un correo de recuperación a tu dirección de email');
    } catch (error: any) {
      console.error("Password reset error:", error);
      toast.error('Error al enviar el correo de recuperación');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAdmin = async () => {
    const email = prompt('Ingrese el correo electrónico del administrador:');
    const password = prompt('Ingrese la contraseña del administrador:');
    
    if (!email || !password) {
      toast.error('Correo o contraseña no proporcionados');
      return;
    }
    
    if (password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    
    setIsLoading(true);
    try {
      const result = await createUserIfNotExists(email, password, true);
      if (result.success) {
        toast.success('Administrador creado exitosamente');
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error("Error creating admin:", error);
      toast.error('Error al crear administrador');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAuthenticated(false);
    setActiveView('login');
    toast.success('Sesión cerrada');
  };

  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const questionData = {
        text: newQuestion.text,
        type: newQuestion.type,
        options: newQuestion.type === 'select' ? newQuestion.options.split(',').map(o => o.trim()) : null
      };

      const { error } = await supabase
        .from('questions')
        .insert([questionData]);

      if (error) throw error;

      setNewQuestion({ text: '', type: 'text', options: '' });
      fetchQuestions();
      toast.success('Pregunta creada exitosamente');
    } catch (error: any) {
      console.error("Error creating question:", error);
      toast.error(error.message || 'Error al crear la pregunta');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('questions')
        .delete()
        .eq('id', questionId);

      if (error) throw error;

      fetchQuestions();
      toast.success('Pregunta eliminada');
    } catch (error: any) {
      console.error("Error deleting question:", error);
      toast.error(error.message || 'Error al eliminar la pregunta');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitAnswers = async () => {
    if (Object.keys(answers).length === 0) {
      toast.error('No hay respuestas para guardar');
      return;
    }
    
    setIsLoading(true);
    try {
      const answersToSubmit = Object.entries(answers).map(([questionId, answerText]) => ({
        question_id: questionId,
        user_id: user?.id,
        answer_text: answerText
      }));

      const { error } = await supabase
        .from('answers')
        .insert(answersToSubmit);

      if (error) throw error;

      setAnswers({});
      toast.success('Respuestas guardadas exitosamente');
    } catch (error: any) {
      console.error("Error submitting answers:", error);
      toast.error(error.message || 'Error al guardar las respuestas');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="px-8 py-6">
              <div className="text-center mb-8">
                <Shield className="h-12 w-12 text-green-600 mx-auto" />
                <h2 className="mt-4 text-2xl font-bold text-gray-900">
                  {activeView === 'login' ? 'Bienvenido' : 
                   activeView === 'register' ? 'Registro' : 
                   'Recuperar Contraseña'}
                </h2>
                <p className="mt-2 text-gray-600">
                  {activeView === 'login' ? 'Inicia sesión para continuar' : 
                   activeView === 'register' ? 'Crea una nueva cuenta' : 
                   'Ingresa tu correo para recuperar tu contraseña'}
                </p>
              </div>
              
              {activeView === 'login' ? (
                <>
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Correo electrónico
                      </label>
                      <input
                        name="email"
                        type="email"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                        placeholder="usuario@ejemplo.com"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Contraseña
                      </label>
                      <input
                        name="password"
                        type="password"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                        placeholder="••••••••"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                    >
                      {isLoading ? 'Procesando...' : 'Iniciar Sesión'}
                    </button>
                  </form>
                  <div className="mt-4 text-center">
                    <p className="text-sm text-gray-600">
                      ¿No tienes una cuenta?{' '}
                      <button
                        onClick={() => setActiveView('register')}
                        className="text-green-600 hover:text-green-800 font-medium"
                      >
                        Regístrate
                      </button>
                    </p>
                    <p className="text-sm text-gray-600 mt-2">
                      ¿Olvidaste tu contraseña?{' '}
                      <button
                        onClick={() => {
                          setActiveView('resetPassword');
                          setResetSent(false);
                        }}
                        className="text-green-600 hover:text-green-800 font-medium"
                      >
                        Recuperar
                      </button>
                    </p>
                  </div>
                  <div className="mt-6 pt-4 border-t border-gray-200">
                    <button
                      onClick={handleCreateAdmin}
                      className="w-full flex items-center justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Crear Usuario Administrador
                    </button>
                  </div>
                </>
              ) : activeView === 'register' ? (
                <>
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Correo electrónico
                      </label>
                      <input
                        name="email"
                        type="email"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                        placeholder="usuario@ejemplo.com"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Contraseña
                      </label>
                      <input
                        name="password"
                        type="password"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                        placeholder="••••••••"
                        required
                        minLength={6}
                      />
                      <p className="mt-1 text-xs text-gray-500">Mínimo 6 caracteres</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Confirmar Contraseña
                      </label>
                      <input
                        name="confirmPassword"
                        type="password"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                        placeholder="••••••••"
                        required
                        minLength={6}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                    >
                      {isLoading ? 'Procesando...' : 'Registrarse'}
                    </button>
                  </form>
                  <div className="mt-4 text-center">
                    <p className="text-sm text-gray-600">
                      ¿Ya tienes una cuenta?{' '}
                      <button
                        onClick={() => setActiveView('login')}
                        className="text-green-600 hover:text-green-800 font-medium"
                      >
                        Inicia sesión
                      </button>
                    </p>
                  </div>
                </>
              ) : (
                <>
                  {!resetSent ? (
                    <form onSubmit={handleResetPassword} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Correo electrónico
                        </label>
                        <input
                          type="email"
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                          placeholder="usuario@ejemplo.com"
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                      >
                        <KeyRound className="h-4 w-4 mr-2" />
                        {isLoading ? 'Enviando...' : 'Enviar correo de recuperación'}
                      </button>
                    </form>
                  ) : (
                    <div className="text-center py-4">
                      <div className="bg-green-50 p-4 rounded-lg mb-4">
                        <p className="text-green-800">
                          Se ha enviado un correo de recuperación a <strong>{resetEmail}</strong>. 
                          Por favor, revisa tu bandeja de entrada y sigue las instrucciones.
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="mt-4 text-center">
                    <button
                      onClick={() => setActiveView('login')}
                      className="text-green-600 hover:text-green-800 font-medium"
                    >
                      Volver al inicio de sesión
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        <Toaster position="top-right" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      <Toaster position="top-right" />
      <nav className="bg-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <ClipboardList className="h-8 w-8 text-green-600" />
              <span className="ml-2 text-xl font-semibold text-gray-900">
                Sistema de Encuestas
              </span>
            </div>
            <div className="flex items-center space-x-4">
              {user?.role === 'admin' && (
                <button
                  onClick={() => setActiveView('admin')}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    activeView === 'admin'
                      ? 'bg-green-100 text-green-700'
                      : 'text-gray-700 hover:bg-green-50'
                  }`}
                >
                  Panel Admin
                </button>
              )}
              <button
                onClick={() => setActiveView('questions')}
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  activeView === 'questions'
                    ? 'bg-green-100 text-green-700'
                    : 'text-gray-700 hover:bg-green-50'
                }`}
              >
                Preguntas
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-red-50 hover:text-red-700"
              >
                <LogOut className="h-4 w-4 mr-1" />
                Salir
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {activeView === 'admin' && user?.role === 'admin' && (
          <div className="space-y-8">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Crear Nueva Pregunta</h2>
              <form onSubmit={handleCreateQuestion} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Pregunta
                  </label>
                  <input
                    type="text"
                    value={newQuestion.text}
                    onChange={(e) => setNewQuestion({ ...newQuestion, text: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                    placeholder="Escribe tu pregunta aquí"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Tipo de Respuesta
                  </label>
                  <select
                    value={newQuestion.type}
                    onChange={(e) => setNewQuestion({ ...newQuestion, type: e.target.value as 'text' | 'select' })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="text">Texto libre</option>
                    <option value="select">Selección múltiple</option>
                  </select>
                </div>
                {newQuestion.type === 'select' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Opciones (separadas por comas)
                    </label>
                    <input
                      type="text"
                      value={newQuestion.options}
                      onChange={(e) => setNewQuestion({ ...newQuestion, options: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                      placeholder="Opción 1, Opción 2, Opción 3"
                      required
                    />
                  </div>
                )}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {isLoading ? 'Creando...' : 'Crear Pregunta'}
                </button>
              </form>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Preguntas Existentes</h2>
              {questions.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No hay preguntas creadas todavía</p>
              ) : (
                <div className="space-y-4">
                  {questions.map((question) => (
                    <div key={question.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{question.text}</p>
                        <p className="text-sm text-gray-500">Tipo: {question.type}</p>
                        {question.options && (
                          <p className="text-sm text-gray-500">
                            Opciones: {question.options.join(', ')}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteQuestion(question.id)}
                        disabled={isLoading}
                        className="p-2 text-red-600 hover:text-red-800 disabled:opacity-50"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeView === 'questions' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Responder Preguntas</h2>
            {questions.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No hay preguntas disponibles para responder</p>
            ) : (
              <div className="space-y-6">
                {questions.map((question) => (
                  <div key={question.id} className="border-b pb-4">
                    <p className="font-medium text-gray-900 mb-2">{question.text}</p>
                    {question.type === 'select' ? (
                      <select
                        value={answers[question.id] || ''}
                        onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                      >
                        <option value="">Selecciona una opción</option>
                        {question.options?.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={answers[question.id] || ''}
                        onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                        placeholder="Tu respuesta"
                      />
                    )}
                  </div>
                ))}
                <button
                  onClick={handleSubmitAnswers}
                  disabled={isLoading || Object.keys(answers).length === 0}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isLoading ? 'Guardando...' : 'Guardar Respuestas'}
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;