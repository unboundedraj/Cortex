import { LoginForm } from "@/components/login-form";
import { SiteHeader } from "@/components/site-header";

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader wordmark="link" />
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <LoginForm />
      </main>
    </div>
  );
}
