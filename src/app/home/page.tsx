"use client";

import Image from "next/image";
import HomeButtons from "@/components/buttons/HomeButtons";
import { homeLinks } from "@/constants/HomeLinks";
import { motion } from "framer-motion";
import ProtectedClient from "@/components/auth/WrapperAuth";
import { StatsFooter } from "@/components/home/StatsFooter";
import logoSiga from "@/assets/icons/SIGA CATTLE ICON.png";
import abczLogo from "@/assets/icons/ABCZ.png";
import pmgzLogo from "@/assets/icons/PMGZ.png";
import cowModel from "@/assets/images/cow_model.png";
import { CalendarNavigation } from "@/components/calendar/CalendarNavigation";
import { useReplication } from "@/hooks/sync/useSyncStatus";
import { useEffect } from "react";
import LogoutButton from "@/components/auth/LogoutBtn";

const HomePage = () => {
  const { triggerSync } = useReplication();

  useEffect(() => {
    console.log("🏠 [Home] Page mounted - triggering synchronization");
    triggerSync();
  }, [triggerSync]);

  return (
    <ProtectedClient>
      <motion.main
        key="home"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeInOut" }}
        className="relative flex h-dvh w-full flex-col items-center justify-between overflow-hidden bg-primary pb-4"
      >
        <div className="relative flex w-full bg-transparent shrink-0 flex-col items-center gap-4 overflow-hidden rounded-b-[2.5rem] pb-12 pt-4 shadow-2xl">
          <Image
            src={cowModel}
            alt="Background"
            fill
            className="object-cover object-center z-10"
            priority
            quality={100}
          />
          <div className="absolute inset-0 bg-primary/65 z-20" />

          <div className="relative z-20 flex w-full flex-col items-center justify-center px-6">
            <Image
              src={logoSiga}
              alt="Nelore INDI Ouro"
              width={180}
              height={60}
              className="object-contain"
              priority
            />
          </div>

          <div className="relative z-50 flex w-full flex-col items-center justify-center px-4">
            <StatsFooter />
          </div>
        </div>

        <div className="relative z-20 flex w-full flex-1 flex-col items-center gap-2 pt-6">
          <HomeButtons data={homeLinks} />
          <span className="text-[11px] text-white">
            Desenvolvido por
            <span className="font-bold"> Persion Tech</span>
          </span>
          <LogoutButton />
        </div>

        <div className="hidden relative z-10 mt-1 lg:flex flex-col items-center gap-2">
          <div className="flex items-center gap-4">
            <Image
              src={abczLogo}
              alt="ABCZ"
              width={26}
              height={26}
              className="object-cover"
            />
            <div className="h-8 w-px bg-slate-400"></div>
            <Image
              src={pmgzLogo}
              alt="PMGZ"
              width={24}
              height={24}
              className="object-cover"
            />
          </div>
        </div>
        <CalendarNavigation />
      </motion.main>
    </ProtectedClient>
  );
};

export default HomePage;
