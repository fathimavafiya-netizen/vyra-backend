declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string | null;
        mobile: string | null;
        name: string;
        username: string;
        profilePic: string;
        role: string;
        isAdminSession?: boolean;
      };
      requestId?: string;
    }
  }
}

export {};
