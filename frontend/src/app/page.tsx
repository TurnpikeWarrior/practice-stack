import Chat from '@/components/Chat';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-100">
      <div className="z-10 w-full max-w-5xl items-center justify-center font-sans text-sm flex flex-col gap-8">
        <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl text-black">
          Welcome to <span className="text-blue-600">COSINT</span>
        </h1>
        <p className="text-xl text-black max-w-2xl text-center">
          Intelligence on your representatives, powered by AI and the official Congress API.
        </p>
        <Chat />
      </div>
    </main>
  );
}
