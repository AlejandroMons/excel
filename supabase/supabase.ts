import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yrnipirnmmluzygibiwi.supabase.co'; // Reemplaza con tu URL de Supabase
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlybmlwaXJubW1sdXp5Z2liaXdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAxNDI0NzIsImV4cCI6MjA1NTcxODQ3Mn0.sq6Xn7ZkYqfZ53dSUr8Vi9oI3S1YKdRZujigNZ1c920'; // Reemplaza con tu clave pública de Supabase

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

import { supabase } from './supabase';

async function login(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.error('Error al iniciar sesión:', error.message);
  } else {
    console.log('Usuario autenticado:', data);
  }
}
