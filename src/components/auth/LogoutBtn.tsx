"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/auth/useAuth";
import { LucideArrowLeftFromLine, LucideClockFading } from "lucide-react";
import { clearAllDatabases } from "@/db/client";

export default function LogoutButton() {
  const {
    actions: { signOut },
  } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await clearAllDatabases(); // Limpa o banco local para o próximo usuário
      await signOut();
      router.push("/login");
    } catch (err) {
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="secondary"
      onClick={handleLogout}
      disabled={loading}
      className="flex items-center absolute top-4 left-4 z-99"
    >
      {loading ? (
        <LucideClockFading size={18} color="blue" />
      ) : (
        <LucideArrowLeftFromLine size={18} color="blue" />
      )}
    </Button>
  );
}
