'use client';

import { User } from '@supabase/supabase-js';
import Link from 'next/link';

type HeaderProps = {
  user: User;
  onSignOut: () => void;
};

export default function Header({ user, onSignOut }: HeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between z-50 shadow-sm">
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
          <span className="text-xs font-bold text-black uppercase tracking-widest leading-none mb-1">Authenticated Terminal</span>
          <span className="text-[10px] text-gray-500 font-mono">{user.email}</span>
        </div>
        <div className="h-8 w-[1px] bg-gray-200 mx-2 hidden md:block"></div>
        <button
          onClick={onSignOut}
          className="px-4 py-2 text-xs font-black uppercase tracking-widest text-gray-500 hover:text-red-600 transition-colors border border-gray-200 rounded-lg hover:border-red-100 hover:bg-red-50"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
