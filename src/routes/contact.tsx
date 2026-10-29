import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { logPageView } from "@/lib/sessionId";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Us — SafeProducts" },
      { name: "description", content: "Get in touch with SafeProducts.in. We respond within 48 hours." },
    ],
  }),
  component: ContactPage,
});

const schema = z.object({
  full_name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  phone: z.string().max(20).optional(),
  user_type: z.string().min(1),
  purpose: z.string().min(1),
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().min(5).max(2000),
});

const USER_TYPES = [
  "Consumer",
  "Healthcare Professional",
  "Manufacturer",
  "Brand/D2C",
  "Affiliate/Partner",
  "Researcher",
  "Media",
  "Other",
];
const PURPOSES = [
  "Product Safety Query",
  "Label Check Request",
  "Report Incorrect Score",
  "Grievance",
  "Partnership/Affiliation",
  "Manufacturer Listing",
  "Advertise on SafeProducts",
  "Verified Badge",
  "Press/Media",
  "General Feedback",
  "Other",
];

function ContactPage() {
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    user_type: "",
    purpose: "",
    subject: "",
    message: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    logPageView({ page: "contact" });
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = schema.safeParse(form);
    if (!r.success) {
      const errs: Record<string, string> = {};
      r.error.issues.forEach((i) => {
        errs[i.path[0] as string] = i.message;
      });
      setErrors(errs);
      return;
    }
    setErrors({});
    setSubmitting(true);
    const { error } = await supabase.rpc("sp_web_submit_contact_v1", {
      p_full_name: r.data.full_name,
      p_email: r.data.email,
      p_phone: r.data.phone || null,
      p_user_type: r.data.user_type,
      p_purpose: r.data.purpose,
      p_subject: r.data.subject,
      p_message: r.data.message,
    });
    setSubmitting(false);
    if (error) {
      setErrors({ message: "Submission failed. Please try again." });
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-brand-blue">Thank you</h1>
        <p className="mt-3 text-sm text-body">We will respond to your email within 48 hours.</p>
        <p className="mt-2 text-sm text-body">
          You may also contact us at{" "}
          <a className="font-semibold text-brand-blue hover:underline" href="mailto:support@safeproducts.in">
            support@safeproducts.in
          </a>
          .
        </p>
      </div>
    );
  }

  const input =
    "w-full rounded-md border border-divider bg-card px-3 py-2.5 text-sm text-heading placeholder:text-body/60 focus:border-brand-blue focus:outline-none";
  const label = "block text-xs font-medium text-body mb-1.5";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-brand-blue sm:text-3xl">Get In Touch</h1>
        <p className="mt-2 text-sm text-body">We respond within 48 hours.</p>
        <p className="mt-2 text-sm text-body">
          Email:{" "}
          <a className="font-semibold text-brand-blue hover:underline" href="mailto:support@safeproducts.in">
            support@safeproducts.in
          </a>
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4 rounded-lg border border-divider bg-card p-5 sm:p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Full Name *</label>
            <input
              className={input}
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
            {errors.full_name && <p className="mt-1 text-xs text-danger">{errors.full_name}</p>}
          </div>
          <div>
            <label className={label}>Email Address *</label>
            <input
              type="email"
              className={input}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            {errors.email && <p className="mt-1 text-xs text-danger">{errors.email}</p>}
          </div>
          <div>
            <label className={label}>Phone Number</label>
            <input
              type="tel"
              className={input}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div>
            <label className={label}>I am a... *</label>
            <select
              className={input}
              value={form.user_type}
              onChange={(e) => setForm({ ...form, user_type: e.target.value })}
            >
              <option value="">Select</option>
              {USER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            {errors.user_type && <p className="mt-1 text-xs text-danger">{errors.user_type}</p>}
          </div>
        </div>
        <div>
          <label className={label}>Purpose *</label>
          <select
            className={input}
            value={form.purpose}
            onChange={(e) => setForm({ ...form, purpose: e.target.value })}
          >
            <option value="">Select</option>
            {PURPOSES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {errors.purpose && <p className="mt-1 text-xs text-danger">{errors.purpose}</p>}
        </div>
        <div>
          <label className={label}>Subject *</label>
          <input
            className={input}
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
          />
          {errors.subject && <p className="mt-1 text-xs text-danger">{errors.subject}</p>}
        </div>
        <div>
          <label className={label}>Message *</label>
          <textarea
            rows={5}
            className={input}
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
          />
          {errors.message && <p className="mt-1 text-xs text-danger">{errors.message}</p>}
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-brand-blue px-5 py-3 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit"}
        </button>
      </form>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {[
          { i: "✉️", t: "Email Support", b: "support@safeproducts.in" },
          { i: "🤝", t: "Partnerships", b: "Manufacturer and affiliate enquiries welcome." },
          { i: "⚖️", t: "Grievance Redressal", b: "All issues reviewed by our pharmacist." },
        ].map((c) => (
          <div key={c.t} className="rounded-lg border border-divider bg-card p-4">
            <div className="text-xl">{c.i}</div>
            <h4 className="mt-1 text-sm font-bold text-heading">{c.t}</h4>
            <p className="mt-1 text-xs text-body">{c.b}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
