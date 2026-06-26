declare module 'netlify-identity-widget' {
  interface User {
    email: string;
    user_metadata?: Record<string, unknown>;
  }
  interface NetlifyIdentity {
    init: (opts?: { container?: string }) => void;
    open: (tabName?: 'login' | 'signup') => void;
    close: () => void;
    on: (event: string, cb: (user?: User) => void) => void;
    off: (event: string, cb?: (user?: User) => void) => void;
    currentUser: () => User | null;
    logout: () => void;
  }
  const netlifyIdentity: NetlifyIdentity;
  export default netlifyIdentity;
}
