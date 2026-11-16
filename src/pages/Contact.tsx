import React, { useState } from 'react';
import { Mail, Github, Linkedin, Send, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { FooterLogo } from '../components/FooterLogo';
import { Link } from 'react-router-dom';

export const Contact: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: 'General Inquiry',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errorMessage) setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.error || `Failed to send message (${response.status})`);
      }

      setSubmitted(true);
      setFormData({
        name: '',
        email: '',
        subject: 'General Inquiry',
        message: '',
      });
    } catch (err: any) {
      console.error('Contact form submission error:', err);
      setErrorMessage(
        err?.message || 'Failed to deliver message. Please check your network or try again later.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full bg-[#f7f7f9] flex flex-col min-h-screen">
      <div className="w-full py-10 sm:py-16 px-4 sm:px-8 md:px-16 lg:px-28 flex-1">
        <div className="max-w-4xl mx-auto flex flex-col gap-8 sm:gap-12">
          
          {/* Title */}
          <div className="flex flex-col gap-3 sm:gap-4 text-center items-center">
            <div className="bg-secondary-500 border-2 border-zinc-900 px-3 sm:px-4 py-1 text-[11px] sm:text-xs font-black uppercase tracking-wider text-zinc-950 shadow-[2px_2px_0px_#27272a]">
              General Inquiries
            </div>
            <h1 className="font-display font-black text-3xl sm:text-5xl text-zinc-900 tracking-tight leading-tight">
              Get in Touch
            </h1>
            <p className="text-zinc-600 max-w-lg text-sm sm:text-lg px-2">
              Have a question about ZeroTouch, found a bug, or interested in discussing the project? I'd be happy to hear from you.
            </p>
          </div>

          {/* Contact Form Card */}
          <div className="bg-white border-4 border-zinc-800 p-5 sm:p-8 md:p-12 shadow-[4px_4px_0px_#27272a] sm:shadow-[8px_8px_0px_#27272a]">
            {submitted ? (
              <div className="flex flex-col items-center text-center gap-4 py-8">
                <CheckCircle2 className="w-14 h-14 sm:w-16 sm:h-16 text-emerald-500 animate-bounce" />
                <h2 className="font-display font-bold text-xl sm:text-2xl text-zinc-900">Message Received!</h2>
                <p className="text-zinc-600 text-xs sm:text-sm max-w-md px-2">
                  Thank you for reaching out. We have received your message and sent a confirmation receipt to your inbox.
                </p>
                <button
                  type="button"
                  onClick={() => setSubmitted(false)}
                  className="btn-secondary mt-4 text-xs font-bold uppercase"
                >
                  Send Another Message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-5 sm:gap-6">
                {errorMessage && (
                  <div className="p-3.5 sm:p-4 bg-red-50 border-2 border-red-500 text-red-800 text-xs sm:text-sm flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <span className="font-bold block">Message Delivery Failed</span>
                      <span className="text-xs text-red-700 mt-0.5 block">{errorMessage}</span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
                  {/* Name Input */}
                  <div className="flex flex-col gap-2">
                    <label htmlFor="name" className="text-xs font-bold uppercase tracking-wider text-zinc-700">
                      Your Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      required
                      disabled={isSubmitting}
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="e.g. Dr. Jane Smith"
                      className="px-4 py-3 bg-[#f7f7f9] border-2 border-zinc-800 focus:border-primary-500 focus:bg-white text-zinc-900 text-sm font-medium focus:outline-none transition-colors disabled:opacity-50"
                    />
                  </div>

                  {/* Email Input */}
                  <div className="flex flex-col gap-2">
                    <label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-zinc-700">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      required
                      disabled={isSubmitting}
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="e.g. janesmith@hospital.org"
                      className="px-4 py-3 bg-[#f7f7f9] border-2 border-zinc-800 focus:border-primary-500 focus:bg-white text-zinc-900 text-sm font-medium focus:outline-none transition-colors disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Subject Dropdown */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="subject" className="text-xs font-bold uppercase tracking-wider text-zinc-700">
                    Subject / Topic
                  </label>
                  <select
                    id="subject"
                    name="subject"
                    disabled={isSubmitting}
                    value={formData.subject}
                    onChange={handleChange}
                    className="px-4 py-3 bg-[#f7f7f9] border-2 border-zinc-800 focus:border-primary-500 focus:bg-white text-zinc-900 text-sm font-medium focus:outline-none transition-colors disabled:opacity-50"
                  >
                    <option value="General Inquiry">General Inquiry</option>
                    <option value="Technical Support">Technical Support / Bug Report</option>
                    <option value="DICOM Compatibility">DICOM Compatibility Question</option>
                    <option value="Gesture Recognition">Gesture Recognition / Model Feedback</option>
                    <option value="Clinical Deployment">Clinical Deployment / Partnership</option>
                  </select>
                </div>

                {/* Message Textarea */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="message" className="text-xs font-bold uppercase tracking-wider text-zinc-700">
                    Your Message <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    required
                    rows={5}
                    disabled={isSubmitting}
                    value={formData.message}
                    onChange={handleChange}
                    placeholder="Describe your inquiry, question, or feedback in detail..."
                    className="px-4 py-3 bg-[#f7f7f9] border-2 border-zinc-800 focus:border-primary-500 focus:bg-white text-zinc-900 text-sm font-medium focus:outline-none transition-colors resize-y disabled:opacity-50"
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full mt-2 bg-[#ff8066] hover:bg-[#ff947d] text-zinc-950 font-black text-sm uppercase tracking-wider py-4 border-2 border-zinc-900 shadow-[4px_4px_0px_#27272a] hover:shadow-[2px_2px_0px_#27272a] hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed select-none"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Sending Message...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Send Message</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>

          {/* Additional Channels */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            <a
              href="mailto:saipraveenamujuri@gmail.com"
              className="bg-white border-2 border-zinc-800 p-5 shadow-[4px_4px_0px_#27272a] hover:shadow-[2px_2px_0px_#27272a] hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center gap-3.5 group"
            >
              <div className="w-10 h-10 rounded-full bg-primary-100 border border-zinc-900 flex items-center justify-center text-primary-600 group-hover:bg-primary-500 group-hover:text-white transition-colors shrink-0">
                <Mail className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="block text-xs font-black uppercase text-zinc-900">Direct Email</span>
                <span className="text-xs text-zinc-500 truncate block">saipraveenamujuri@gmail.com</span>
              </div>
            </a>

            <a
              href="https://github.com/saipraveenamujuri"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white border-2 border-zinc-800 p-5 shadow-[4px_4px_0px_#27272a] hover:shadow-[2px_2px_0px_#27272a] hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center gap-3.5 group"
            >
              <div className="w-10 h-10 rounded-full bg-zinc-100 border border-zinc-900 flex items-center justify-center text-zinc-900 group-hover:bg-zinc-900 group-hover:text-white transition-colors shrink-0">
                <Github className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="block text-xs font-black uppercase text-zinc-900">GitHub</span>
                <span className="text-xs text-zinc-500 truncate block">@saipraveenamujuri</span>
              </div>
            </a>

            <a
              href="https://linkedin.com/in/sai-praveen-amujuri"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white border-2 border-zinc-800 p-5 shadow-[4px_4px_0px_#27272a] hover:shadow-[2px_2px_0px_#27272a] hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center gap-3.5 group"
            >
              <div className="w-10 h-10 rounded-full bg-[#6f7bd4]/10 border border-zinc-900 flex items-center justify-center text-[#6f7bd4] group-hover:bg-[#6f7bd4] group-hover:text-white transition-colors shrink-0">
                <Linkedin className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="block text-xs font-black uppercase text-zinc-900">LinkedIn</span>
                <span className="text-xs text-zinc-500 truncate block">Sai Praveen Amujuri</span>
              </div>
            </a>
          </div>

        </div>
      </div>

      {/* Matching Loz Page Footer */}
      <footer className="footer bg-[#18181b] px-6 sm:px-8 pt-12 pb-8 text-white w-full border-t-4 border-[#27272a]">
        <div className="max-w-6xl mx-auto flex flex-col items-center text-center">
          <div className="w-full flex justify-center my-6 select-none px-4">
            <FooterLogo className="max-w-[240px] sm:max-w-[440px] md:max-w-[720px]" />
          </div>
          <div className="flex flex-wrap justify-center gap-4 sm:gap-8 text-xs sm:text-sm font-bold uppercase tracking-wider text-zinc-400 mt-2">
            <Link to="/" className="hover:text-white">Home</Link>
            <Link to="/features" className="hover:text-white">Product</Link>
            <Link to="/docs" className="hover:text-white">Docs</Link>
            <Link to="/contact" className="hover:text-white">Contact</Link>
            <Link to="/viewer" className="hover:text-[#74d2c2]">Launch</Link>
          </div>
          <p className="text-xs text-zinc-500 mt-4">
            © 2026 0Touch. All rights reserved.{' '}
            <a
              href="https://praveen-amujuri-portfolio.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#74d2c2] hover:underline"
            >
              praveenai.tech
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
};
