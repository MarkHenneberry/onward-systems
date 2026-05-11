import { Globe, Inbox, Clock } from "lucide-react";

const problems = [
  {
    icon: Globe,
    title: "No clear online home",
    body: "Customers land on an outdated page, an incomplete Google listing, or nothing at all. First impressions that should be building trust are working against you instead.",
  },
  {
    icon: Inbox,
    title: "Leads slip through",
    body: "Quote requests, follow-ups, and messages are scattered across Facebook, email, phone, and texts. Good opportunities get missed simply because there's no system.",
  },
  {
    icon: Clock,
    title: "Admin eats your time",
    body: "You repeat the same replies, chase the same follow-ups, and manually handle work that could be systemized. Time that should go into the job goes into the inbox.",
  },
];

export default function Problem() {
  return (
    <section className="section-pad bg-[#f8f7f4]" id="problem">
      <div className="container-max">
        {/* Header */}
        <div className="max-w-2xl mb-14">
          <p className="section-eyebrow">Sound familiar?</p>
          <h2 className="text-3xl md:text-4xl font-bold text-[#0f1c40] mb-4">
            The basics are often scattered.
          </h2>
          <p className="text-lg text-slate-600 leading-relaxed">
            A lot of good businesses lose time, trust, and money because the basics are spread across
            old pages, social profiles, inboxes, and texts.
          </p>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {problems.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="card hover:shadow-card-hover transition-shadow duration-300 group"
            >
              <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-5 group-hover:bg-blue-100 transition-colors">
                <Icon size={20} className="text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-[#0f1c40] mb-2">{title}</h3>
              <p className="text-slate-600 leading-relaxed text-sm">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
