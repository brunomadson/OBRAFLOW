"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { SETORES_NAV } from "@/constants/dominios";
import { cn } from "@/lib/utils";

interface Props {
  notifCount: number;
}

export default function Sidebar({ notifCount }: Props) {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();

  const isDono = profile?.cargo === "CEO / Dono";
  const setoresUser = isDono ? SETORES_NAV.map((s) => s.id) : (profile?.setores ?? []);
  const setoresVisiveis = SETORES_NAV.filter((s) => setoresUser.includes(s.id));

  return (
    <aside className="fixed top-0 left-0 bottom-0 w-[200px] bg-slate-950 flex flex-col z-[100]">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-emerald-500 rounded-lg flex items-center justify-center text-base flex-shrink-0">
            🏗
          </div>
          <span className="font-extrabold text-base text-white tracking-tight">ObraFlow</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3">
        {setoresVisiveis.map((s) => {
          const isActive = pathname.startsWith(`/${s.id}`);
          return (
            <Link
              key={s.id}
              href={`/${s.id}`}
              className={cn(
                "sidebar-item relative",
                isActive ? "active" : "hover:bg-slate-900"
              )}
              style={{ borderLeftColor: isActive ? s.cor : "transparent" }}
            >
              <span className="text-lg flex-shrink-0">{s.emoji}</span>
              <div>
                <div
                  className={cn(
                    "text-[13px] leading-tight",
                    isActive ? "font-bold text-white" : "font-medium text-slate-400"
                  )}
                >
                  {s.label}
                </div>
                <div
                  className="text-[10px] leading-tight mt-0.5"
                  style={{ color: isActive ? s.cor : "#475569" }}
                >
                  {s.desc}
                </div>
              </div>
              {s.id === "notificacoes" && notifCount > 0 && (
                <span className="absolute top-2 right-3 min-w-[18px] h-[18px] bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white px-1">
                  {notifCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Usuário */}
      <div className="px-5 py-4 border-t border-slate-800">
        <div className="flex items-center gap-2.5 mb-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-extrabold flex-shrink-0 border-[1.5px]"
            style={{
              background: (profile?.cor ?? "#3B82F6") + "33",
              borderColor: profile?.cor ?? "#3B82F6",
              color: profile?.cor ?? "#3B82F6",
            }}
          >
            {profile?.nome?.charAt(0) ?? "?"}
          </div>
          <div className="min-w-0">
            <div className="text-[12px] font-bold text-white truncate">
              {profile?.nome?.split(" ")[0] ?? "Usuário"}
            </div>
            <div className="text-[10px] text-slate-500 truncate">{profile?.cargo}</div>
          </div>
        </div>
        <button
          onClick={signOut}
          className="w-full bg-transparent border border-slate-700 hover:border-slate-600 rounded-lg py-1.5 text-[11px] font-semibold text-slate-500 hover:text-slate-400 cursor-pointer transition-colors"
        >
          Sair
        </button>
      </div>
    </aside>
  );
}
