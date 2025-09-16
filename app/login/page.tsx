import '../globals.css';

// Avoid prerender; render this page dynamically at request time
export const dynamic = 'force-dynamic';

import LoginClient from './LoginClient';

export default function LoginPage() {
  return <LoginClient />;
}
