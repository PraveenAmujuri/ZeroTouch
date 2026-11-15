import React, { useState } from 'react';
import { Mail, Github, Linkedin, Send, CheckCircle2 } from 'lucide-react';

export const Contact: React.FC = () => {
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="w-full bg-[#f7f7f9] py-16 px-6 md:px-16 lg:px-28">
      <div className="max-w-4xl mx-auto flex flex-col gap-12">
        
        {/* Title */}
        <div className="flex flex-col gap-4 text-center items-center">
          <div className="bg-secondary-500 border-2 border-zinc-900 px-4 py-1 text-xs font-black uppercase tracking-wider text-zinc-950 shadow-[2px_2px_0px_#27272a]">
            General Inquiries
          </div>
          <h1 className="font-display font-black text-4xl sm:text-5xl text-zinc-900 tracking-tight">
            Get in Touch
          </h1>
          <p className="text-zinc-600 max-w-lg text-base sm:text-lg">
            Have a question about ZeroTouch, found a bug, or interested in discussing the project? I'd be happy to hear from you.
          </p>
        </div>

        {/* Contact Form Card */}
        <div className="bg-white border-4 border-zinc-800 p-8 sm:p-12 shadow-[8px_8px_0px_#27272a]">
          {submitted ? (
            <div className="flex flex-col items-center text-center gap-4 py-8">
              <CheckCircle2 className="w-16 h-16 text-emerald-500 animate-bounce" />
              <h2 className="font-display font-bold text-2xl text-zinc-900">Message Received!</h2>
              <p className="text-zinc-600 text-sm max-w-md">
                Thank you for reaching out. I will get back to you as soon as possible.
              </p>
              <button
                onClick={() => setSubmitted(false)}
                className="btn-secondary mt-4 text-xs font-bold uppercase"
              >
                Send Another Message
              </button>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSubmitted(true);
              }}
              className="flex flex-col gap-6"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-black uppercase tracking-wider text-zinc-700">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Your name"
                    className="p-3.5 bg-zinc-50 border-2 border-zinc-700 font-medium text-zinc-900 focus:outline-none focus:border-secondary-500"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-black uppercase tracking-wider text-zinc-700">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="your.email@example.com"
                    className="p-3.5 bg-zinc-50 border-2 border-zinc-700 font-medium text-zinc-900 focus:outline-none focus:border-secondary-500"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-black uppercase tracking-wider text-zinc-700">
                  Subject
                </label>
                <select className="p-3.5 bg-zinc-50 border-2 border-zinc-700 font-medium text-zinc-900 focus:outline-none focus:border-secondary-500">
                  <option>General Inquiry</option>
                  <option>Project Feedback</option>
                  <option>Bug Report</option>
                  <option>Collaboration</option>
                  <option>Research Discussion</option>
                  <option>Other</option>
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-black uppercase tracking-wider text-zinc-700">
                  Message *
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Your message or questions about ZeroTouch..."
                  className="p-3.5 bg-zinc-50 border-2 border-zinc-700 font-medium text-zinc-900 focus:outline-none focus:border-secondary-500"
                />
              </div>

              <button type="submit" className="btn-primary self-start gap-2 mt-2">
                <Send className="w-4 h-4" />
                <span>Send Message</span>
              </button>
            </form>
          )}
        </div>

        {/* Contact info cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <a
            href="mailto:saipraveenamujuri@gmail.com"
            className="p-6 bg-white border-2 border-zinc-800 shadow-[3px_3px_0px_#27272a] flex items-center gap-4 transition-transform hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_#27272a]"
          >
            <Mail className="w-6 h-6 text-primary-500 shrink-0" />
            <div className="text-xs min-w-0">
              <div className="font-bold uppercase text-zinc-500">Email</div>
              <div className="font-bold text-zinc-900 truncate">saipraveenamujuri@gmail.com</div>
            </div>
          </a>
          <a
            href="https://github.com/PraveenAmujuri"
            target="_blank"
            rel="noopener noreferrer"
            className="p-6 bg-white border-2 border-zinc-800 shadow-[3px_3px_0px_#27272a] flex items-center gap-4 transition-transform hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_#27272a]"
          >
            <Github className="w-6 h-6 text-secondary-500 shrink-0" />
            <div className="text-xs min-w-0">
              <div className="font-bold uppercase text-zinc-500">GitHub</div>
              <div className="font-bold text-zinc-900 truncate">github.com/PraveenAmujuri</div>
            </div>
          </a>
          <a
            href="https://linkedin.com/in/sai-praveen-amujuri-738bb4358/"
            target="_blank"
            rel="noopener noreferrer"
            className="p-6 bg-white border-2 border-zinc-800 shadow-[3px_3px_0px_#27272a] flex items-center gap-4 transition-transform hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_#27272a]"
          >
            <Linkedin className="w-6 h-6 text-tertiary-400 shrink-0" />
            <div className="text-xs min-w-0">
              <div className="font-bold uppercase text-zinc-500">LinkedIn</div>
              <div className="font-bold text-zinc-900 truncate">sai-praveen-amujuri</div>
            </div>
          </a>
        </div>

      </div>
    </div>
  );
};
