'use client';

export default function ProductsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1">
      <main className="w-full px-4 py-8">
        {children}
      </main>
    </div>
  );
} 