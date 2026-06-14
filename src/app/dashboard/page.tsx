import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const navLinks = [
    { href: "/medications", label: "Medications", description: "Track doses and changes" },
    { href: "/symptoms", label: "Symptoms", description: "Log daily energy, mood, appetite, pain" },
    { href: "/labs", label: "Lab Results", description: "Upload and review blood work" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">ChroniCare</h1>
          <span className="text-sm text-gray-500">{user.email}</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Welcome to ChroniCare</h2>
          <p className="mt-1 text-gray-500">Track medications, symptoms, and lab results.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block rounded-xl border border-gray-200 bg-white p-6 hover:border-gray-400 hover:shadow-sm transition-all"
            >
              <p className="font-medium text-gray-900">{link.label}</p>
              <p className="mt-1 text-sm text-gray-500">{link.description}</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
