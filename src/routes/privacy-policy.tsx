import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

export const Route = createFileRoute("/privacy-policy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — SafeProducts.in" },
      { name: "description", content: "Privacy Policy for SafeProducts.in — how we collect, use, and protect your information under the DPDP Act 2023." },
      { property: "og:title", content: "Privacy Policy — SafeProducts.in" },
      { property: "og:description", content: "How SafeProducts.in handles your data, cookies, and privacy rights." },
    ],
  }),
  component: PrivacyPolicyPage,
});

const TODAY = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

type Section = { title: string; body: React.ReactNode };

const SECTIONS: Section[] = [
  {
    title: "1. WHO WE ARE",
    body: (
      <>
        <p>SafeProducts (www.safeproducts.in) is an independent consumer awareness platform operated by Dr. Jagdish Singh Badhan, Registered Pharmacist, India.</p>
        <p>Contact: support@safeproducts.in</p>
      </>
    ),
  },
  {
    title: "2. INFORMATION WE COLLECT",
    body: (
      <>
        <p className="font-semibold text-heading">2a. Information you provide voluntarily:</p>
        <p>When you submit the contact form, we collect your name, email address, phone number (optional), and message content. This is used solely to respond to your query.</p>
        <p>When you upload a product label for analysis, the image is processed to extract ingredient information and is not linked to your identity.</p>
        <p className="font-semibold text-heading">2b. Information collected automatically:</p>
        <p>We collect anonymised usage data including pages visited, search terms entered, device type, and approximate geographic region (city level only). This data contains no personally identifiable information and is used solely to improve the platform.</p>
        <p className="font-semibold text-heading">2c. Location data:</p>
        <p>If you use the quick-delivery search feature (e.g. Blinkit), we request your approximate location to show relevant local results. Location data is used only for that search session and is not stored permanently.</p>
      </>
    ),
  },
  {
    title: "3. HOW WE USE YOUR INFORMATION",
    body: (
      <>
        <ul className="list-none space-y-1">
          <li>— To respond to contact form submissions</li>
          <li>— To perform product label safety analysis</li>
          <li>— To improve search results and platform features</li>
          <li>— To send service-related communications (if you have contacted us)</li>
        </ul>
        <p>We do not use your data for advertising profiling or sell your data to any third party under any circumstances.</p>
      </>
    ),
  },
  {
    title: "4. AFFILIATE LINKS AND THIRD PARTIES",
    body: (
      <>
        <p>Product listings on SafeProducts contain affiliate links to third-party marketplaces including Amazon, Flipkart, Nykaa, and others. When you click these links you are directed to the respective platform and their privacy policy applies to that transaction.</p>
        <p>SafeProducts may earn a commission on qualifying purchases. We have no access to your payment information or purchase details.</p>
      </>
    ),
  },
  {
    title: "5. COOKIES",
    body: (
      <p>SafeProducts uses only functional cookies necessary for the platform to operate — including your selected user profile (ALL/Children/Pregnant Women/Seniors) and your shortlisted products within a session. We do not use advertising cookies or tracking pixels.</p>
    ),
  },
  {
    title: "6. DATA RETENTION",
    body: (
      <>
        <p>Contact form submissions are retained for 12 months for grievance redressal purposes and then permanently deleted.</p>
        <p>Label analysis images are processed in real time and not retained beyond the active session unless you explicitly save your report.</p>
        <p>Anonymised analytics data is retained for 24 months in aggregate form only.</p>
      </>
    ),
  },
  {
    title: "7. YOUR RIGHTS",
    body: (
      <>
        <p>Under the Digital Personal Data Protection Act 2023 (India), you have the right to:</p>
        <ul className="list-none space-y-1">
          <li>— Access the personal data we hold about you</li>
          <li>— Correct inaccurate personal data</li>
          <li>— Request erasure of your personal data</li>
          <li>— Withdraw consent for data processing</li>
        </ul>
        <p>To exercise any right, write to: support@safeproducts.in</p>
        <p>We will respond within 30 days.</p>
      </>
    ),
  },
  {
    title: "8. CHILDREN'S PRIVACY",
    body: (
      <p>SafeProducts does not knowingly collect personal data from children under 18 years of age. The platform is intended for use by adult consumers making product decisions for themselves or their families.</p>
    ),
  },
  {
    title: "9. SECURITY",
    body: (
      <p>We implement appropriate technical and organisational measures to protect your data against unauthorised access, disclosure, or destruction. Our platform uses SSL encryption and secure database storage.</p>
    ),
  },
  {
    title: "10. CHANGES TO THIS POLICY",
    body: (
      <p>We may update this Privacy Policy periodically. The date at the top of this page reflects the most recent revision. Continued use of the platform constitutes acceptance of the updated policy.</p>
    ),
  },
  {
    title: "11. CONTACT FOR PRIVACY MATTERS",
    body: (
      <>
        <p>Dr. Jagdish Singh Badhan</p>
        <p>Data Fiduciary — SafeProducts.in</p>
        <p>Email: support@safeproducts.in</p>
        <p>SafeProducts.in, India</p>
      </>
    ),
  },
];

function PrivacyPolicyPage() {
  const [open, setOpen] = useState<Record<number, boolean>>({ 0: true });

  const toggle = (i: number) => setOpen((prev) => ({ ...prev, [i]: !prev[i] }));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold sm:text-3xl" style={{ color: "#38BDF8" }}>Privacy Policy</h1>
        <p className="mt-2 text-sm font-semibold text-heading">SafeProducts.in</p>
        <p className="mt-1 text-sm text-body">Last Updated: {TODAY}</p>
      </div>

      <div className="space-y-3">
        {SECTIONS.map((s, i) => {
          const isOpen = !!open[i];
          return (
            <div key={s.title} className="overflow-hidden rounded-lg border border-divider bg-card">
              <button
                type="button"
                onClick={() => toggle(i)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/30"
              >
                <span className="text-sm font-bold sm:text-base" style={{ color: "#38BDF8" }}>{s.title}</span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                  style={{ color: "#38BDF8" }}
                />
              </button>
              {isOpen && (
                <div className="space-y-3 px-4 pb-4 pt-1 text-sm leading-relaxed" style={{ color: "#94A3B8" }}>
                  {s.body}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
