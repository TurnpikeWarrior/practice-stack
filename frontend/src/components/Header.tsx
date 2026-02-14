'use client';

import { User } from '@supabase/supabase-js';
import Link from 'next/link';

type HeaderProps = {
  user: User;
  onSignOut: () => void;
};

export default function Header({ user, onSignOut }: HeaderProps) {
  return (
    <header className="relative z-50 h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between shadow-sm shrink-0">
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-black text-white text-xl shadow-inner">
            C
          </div>
          <span className="text-lg font-extrabold tracking-tight text-black">
            Welcome to <span className="text-blue-600">COSINT</span>
          </span>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden md:flex flex-col items-end">
          <span className="text-[10px] font-black text-black uppercase tracking-[0.2em] leading-none mb-1">Authenticated Terminal</span>
          <span className="text-xs text-gray-700 font-bold font-mono bg-gray-50 px-2 py-0.5 rounded border border-gray-100">{user.email}</span>
        </div>
        <div className="h-8 w-[1px] bg-gray-200 mx-2 hidden md:block" aria-hidden="true"></div>
        <button
          onClick={onSignOut}
          className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-gray-700 hover:text-red-700 transition-colors border border-gray-300 rounded-lg hover:border-red-200 hover:bg-red-50 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
