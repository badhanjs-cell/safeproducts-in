import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — SafeProducts" },
      { name: "description", content: "How SafeProducts.in collects, uses, and protects your information." },
    ],
  }),
  component: PrivacyPage,
});

const SECTIONS = [
  { t: "Information We Collect", b: "SafeProducts.in collects only the minimum information required to provide our service: search queries, the profile filter you select, page views, label images you voluntarily upload for analysis, and any details you provide through the contact form. We do not require user accounts to use the safety search and label-checking features." },
  { t: "How We Use Information", b: "We use collected information to: (a) generate product safety scores; (b) analyse uploaded label images via a secure AI service; (c) improve the platform through aggregate analytics; (d) respond to enquiries submitted via the contact form. We do not sell personal data." },
  { t: "Cookies and Local Storage", b: "We use a single anonymous session identifier stored in your browser to attribute analytics events and to remember your shortlisted products. No third-party advertising cookies are used." },
  { t: "Label Images", b: "Images uploaded to Check My Label are processed transiently to extract ingredient text. The extracted ingredient list and resulting safety report are stored to allow you to retrieve the report later within the same session. Images themselves are not retained beyond processing." },
  { t: "Third-Party Services", b: "We use Lovable Cloud (PostgreSQL backend, hosted in compliant data centres) for storage and Lovable AI Gateway (Google Gemini / OpenAI) for label analysis. These providers process data on our behalf under contractual safeguards." },
  { t: "Affiliate Links", b: "Product cards may contain affiliate links to e-commerce platforms (Amazon, Flipkart, Nykaa, Blinkit and others). When you click a link and complete a purchase, SafeProducts.in may earn a commission. This does not influence our safety scoring." },
  { t: "Children", b: "SafeProducts.in is not intended for direct use by children under 13. Parents and guardians are encouraged to use the Children profile filter when researching products for minors." },
  { t: "Your Rights", b: "You may request deletion of any information you have submitted to us — including contact form submissions and label analyses — by writing to support@safeproducts.in. We will action requests within 30 days." },
  { t: "Changes to This Policy", b: "We may update this policy from time to time. Material changes will be notified through a banner on the homepage. Continued use of the platform constitutes acceptance of the updated terms." },
  { t: "Contact", b: "Questions, concerns, or requests under this policy can be sent to support@safeproducts.in. We respond within 48 hours." },
];

function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-blue sm:text-3xl">Privacy Policy</h1>
        <p className="mt-2 text-sm text-body">Last updated: 5 May 2026</p>
      </div>

      <div className="space-y-6">
        {SECTIONS.map((s, i) => (
          <section key={s.t}>
            <h2 className="mb-2 text-base font-bold text-brand-blue">{i + 1}. {s.t}</h2>
            <p className="text-sm leading-relaxed text-body">{s.b}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
