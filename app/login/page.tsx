import '../globals.css';

// Route options must be defined in a Server Component file
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

import LoginClient from './LoginClient';

export default function LoginPage() {
  return <LoginClient />;
}
