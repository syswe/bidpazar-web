'use client';

import { useState } from 'react';
import Footer from "@/components/Footer";

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    // Simulate form submission
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Mock successful submission
    setIsSubmitting(false);
    setSubmitted(true);

    // Reset form
    setFormData({
      name: '',
      email: '',
      subject: '',
      message: ''
    });
  };

  return (
    <>
      <div className="max-w-4xl mx-auto p-6 md:p-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-8 text-[var(--foreground)]">
          <span className="border-b-4 border-[var(--accent)] pb-2">Bize Ulaşın</span>
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          <div>
            <h2 className="text-2xl font-semibold mb-6">İletişim Bilgileri</h2>

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-2">Telefon</h3>
                <p className="text-[var(--foreground)]">
                  <a href="tel:05078314424" className="hover:text-[var(--primary)]">0507 831 4424</a>
                </p>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-2">E-posta</h3>
                <p className="text-[var(--foreground)]">
                  <a href="mailto:bidpazar@gmail.com" className="hover:text-[var(--primary)]">bidpazar@gmail.com</a>
                </p>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-2">Çalışma Saatleri</h3>
                <p className="text-[var(--foreground)]">
                  Pazartesi - Cuma: 09:00 - 18:00<br />
                  Cumartesi: 10:00 - 14:00<br />
                  Pazar: Kapalı
                </p>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-6">Bize Yazın</h2>

            {submitted ? (
              <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-lg">
                <h3 className="font-semibold mb-2">Mesajınız Gönderildi!</h3>
                <p>Teşekkürler! Mesajınız ekibimize iletildi. En kısa sürede size dönüş yapacağız.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium mb-1">
                    Adınız Soyadınız
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full p-2 border border-[var(--border)] rounded-md bg-[var(--background)] text-[var(--foreground)]"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium mb-1">
                    E-posta Adresiniz
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full p-2 border border-[var(--border)] rounded-md bg-[var(--background)] text-[var(--foreground)]"
                  />
                </div>

                <div>
                  <label htmlFor="subject" className="block text-sm font-medium mb-1">
                    Konu
                  </label>
                  <select
                    id="subject"
                    name="subject"
                    required
                    value={formData.subject}
                    onChange={handleChange}
                    className="w-full p-2 border border-[var(--border)] rounded-md bg-[var(--background)] text-[var(--foreground)]"
                  >
                    <option value="">Seçiniz</option>
                    <option value="siparis">Sipariş Bilgisi</option>
                    <option value="iade">İade ve Geri Ödeme</option>
                    <option value="hesap">Hesap İşlemleri</option>
                    <option value="teknik">Teknik Sorun</option>
                    <option value="diger">Diğer</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium mb-1">
                    Mesajınız
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={5}
                    required
                    value={formData.message}
                    onChange={handleChange}
                    className="w-full p-2 border border-[var(--border)] rounded-md bg-[var(--background)] text-[var(--foreground)]"
                  ></textarea>
                </div>

                {error && (
                  <div className="text-red-500 text-sm">{error}</div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white font-medium py-2 px-4 rounded-md transition-colors disabled:opacity-70"
                >
                  {isSubmitting ? 'Gönderiliyor...' : 'Gönder'}
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="rounded-lg overflow-hidden border border-[var(--border)] h-96 mb-8">
          {/* Placeholder for a map - in a real app, you would integrate Google Maps or another map service */}
          <div className="w-full h-full bg-[var(--muted)] flex items-center justify-center">
            <p className="text-[var(--foreground)] opacity-70 text-center">
              Burada harita görüntülenecektir.<br />
              Gerçek uygulamada Google Maps veya başka bir harita servisi entegre edilecektir.
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
} 