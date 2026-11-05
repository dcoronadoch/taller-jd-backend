declare global {
  namespace Express {
    interface Request {
      // Datos del usuario autenticado (los agrega auth.middleware).
      authUser?: { id: number; email: string; role: string };
    }
  }
}

export {};
