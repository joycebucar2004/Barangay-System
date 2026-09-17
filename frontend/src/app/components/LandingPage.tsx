import { useEffect, useState } from "react";
import { BarangayLogo } from "./BarangayLogo";
import {
  FileText,
  Menu,
  X,
  Phone,
  Mail,
  MapPin,
  Clock,
  ArrowRight,
  CheckCircle2,
  Megaphone,
  CalendarClock,
  ShieldCheck,
  HeartHandshake,
  Home as HomeIcon,
  Briefcase,
  Facebook,
  AlertTriangle,
  Users,
  UserSearch,
  type LucideIcon,
} from "lucide-react";
import type { ApiAnnouncement, ApiDocumentType, AnnouncementTag } from "../lib/api";

const NAV_LINKS = [
  { id: "home", label: "Home" },
  { id: "services", label: "Services" },
  { id: "info", label: "Info" },
];

const ANNOUNCEMENT_STYLE: Record<AnnouncementTag, { tagColor: string; icon: LucideIcon }> = {
  Advisory: { tagColor: "bg-amber-100 text-amber-700", icon: AlertTriangle },
  Announcement: { tagColor: "bg-blue-100 text-blue-700", icon: Megaphone },
  Event: { tagColor: "bg-emerald-100 text-emerald-700", icon: CalendarClock },
  Notice: { tagColor: "bg-rose-100 text-rose-700", icon: Users },
};

function formatAnnouncementDate(date: string) {
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" });
}

const DOC_ICONS: Record<string, LucideIcon> = {
  "Barangay Clearance": ShieldCheck,
  "Indigency Certificate": HeartHandshake,
  "Residency Certificate": HomeIcon,
  "Business Permit": Briefcase,
  "First-Time Job Seeker Certificate": UserSearch,
  "Certificate of Cohabitation": Users,
};

function getDocIcon(name: string) {
  return DOC_ICONS[name] || FileText;
}

export function LandingPage({
  docTypes,
  announcements,
  onSignIn,
}: {
  docTypes: ApiDocumentType[];
  announcements: ApiAnnouncement[];
  onSignIn: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function scrollTo(id: string) {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="min-h-screen bg-background scroll-smooth" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Navbar */}
      <header
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-200 ${
          scrolled ? "bg-white/90 backdrop-blur-md shadow-sm border-b border-border" : "bg-transparent"
        }`}
      >
        <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-16 h-20 flex items-center justify-between">
          <button onClick={() => scrollTo("home")} className="flex items-center gap-3">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${scrolled ? "bg-primary" : "bg-white/15 border border-white/25"}`}>
              <BarangayLogo size={48} className="text-white" />
            </div>
            <div className="text-left leading-tight">
              <div
                className={`font-bold text-lg ${scrolled ? "text-foreground" : "text-white"}`}
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Barangay Campagao
              </div>
              <div className={`text-sm ${scrolled ? "text-muted-foreground" : "text-blue-200"}`}>Document Request System</div>
            </div>
          </button>

          <nav className="hidden md:flex items-center gap-2">
            {NAV_LINKS.map((link) => (
              <button
                key={link.id}
                onClick={() => scrollTo(link.id)}
                className={`px-5 py-2.5 rounded-lg text-base font-semibold transition-colors ${
                  scrolled ? "text-foreground/80 hover:text-primary hover:bg-primary/5" : "text-white/90 hover:text-white hover:bg-white/10"
                }`}
              >
                {link.label}
              </button>
            ))}
            <button
              onClick={onSignIn}
              className="ml-3 px-7 py-3 rounded-lg bg-primary text-white text-base font-semibold hover:bg-primary/90 transition-colors shadow-sm"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Sign In
            </button>
          </nav>

          <button
            className={`md:hidden w-12 h-12 flex items-center justify-center rounded-lg ${scrolled ? "text-foreground" : "text-white"}`}
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden bg-white border-t border-border px-6 py-4 space-y-1 shadow-sm">
            {NAV_LINKS.map((link) => (
              <button
                key={link.id}
                onClick={() => scrollTo(link.id)}
                className="block w-full text-left px-4 py-3 rounded-lg text-base font-semibold text-foreground/80 hover:text-primary hover:bg-primary/5"
              >
                {link.label}
              </button>
            ))}
            <button
              onClick={onSignIn}
              className="w-full mt-1 px-4 py-3 rounded-lg bg-primary text-white text-base font-semibold"
            >
              Sign In
            </button>
          </div>
        )}
      </header>

      {/* Hero */}
      <section
        id="home"
        className="relative min-h-screen flex items-center pt-24 pb-16 px-6 sm:px-10 lg:px-16 overflow-hidden"
        style={{ background: "linear-gradient(150deg, #1a3a6b 0%, #0d2244 100%)" }}
      >
        <div
          className="absolute -top-24 -right-24 w-[32rem] h-[32rem] rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #d4a017 0%, transparent 70%)" }}
        />
        <div
          className="absolute bottom-0 left-0 w-96 h-96 rounded-full opacity-10 -translate-x-1/2 translate-y-1/2"
          style={{ background: "radial-gradient(circle, #ffffff 0%, transparent 70%)" }}
        />

        <div className="relative max-w-[1600px] w-full mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/15 rounded-full px-4 py-2 text-blue-100 text-sm font-semibold mb-8">
              <BarangayLogo size={16} />
              Official Barangay Portal
            </div>
            <h1
              className="text-white text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-tight mb-6"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Fast. Transparent.<br />At Your Service.
            </h1>
            <p className="text-blue-200 text-xl leading-relaxed max-w-xl mb-10">
              Request barangay clearances and certificates, stay updated on community announcements,
              and reach our office — all in one place. No more long queues.
            </p>
            <div className="flex flex-wrap gap-4">
              <button
                onClick={onSignIn}
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-[#d4a017] text-[#1a3a6b] font-bold text-lg hover:bg-[#e0ac1f] transition-colors shadow-md"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Get Started <ArrowRight size={20} />
              </button>
              <button
                onClick={() => scrollTo("services")}
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-white/10 border border-white/20 text-white font-semibold text-lg hover:bg-white/15 transition-colors"
              >
                View Services
              </button>
            </div>

          </div>

          {announcements.length > 0 && (
            <div className="hidden lg:block">
              <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-sm space-y-4">
                <div className="text-blue-100 text-base font-semibold mb-1">Latest Announcement</div>
                <div className="bg-white rounded-2xl p-7 shadow-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full ${ANNOUNCEMENT_STYLE[announcements[0].tag].tagColor}`}>
                      {(() => { const Icon = ANNOUNCEMENT_STYLE[announcements[0].tag].icon; return <Icon size={15} />; })()} {announcements[0].tag}
                    </span>
                    <span className="text-muted-foreground text-sm">{formatAnnouncementDate(announcements[0].date)}</span>
                  </div>
                  <div className="font-bold text-foreground mb-2 text-lg" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    {announcements[0].title}
                  </div>
                  <p className="text-muted-foreground text-base leading-relaxed">{announcements[0].body}</p>
                </div>
                <button
                  onClick={() => scrollTo("info")}
                  className="text-blue-200 text-base font-semibold hover:text-white flex items-center gap-1.5"
                >
                  See all announcements <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Services */}
      <section id="services" className="py-28 px-6 sm:px-10 lg:px-16 bg-background">
        <div className="max-w-[1600px] mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 text-primary text-sm font-bold tracking-wide uppercase mb-4">
              <FileText size={18} /> Our Services
            </div>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-foreground mb-4" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Clearances & Certificates
            </h2>
            <p className="text-muted-foreground text-lg">
              Apply online for the documents you need. Track your request status from submission to release.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {(docTypes.length ? docTypes : FALLBACK_DOC_TYPES).map((doc) => {
              const Icon = getDocIcon(doc.name);
              return (
                <div
                  key={doc.name}
                  className="bg-card rounded-2xl border border-border p-8 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
                >
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
                    <Icon size={30} className="text-primary" />
                  </div>
                  <h3 className="font-bold text-foreground mb-2 text-lg" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    {doc.name}
                  </h3>
                  <div className="text-base font-semibold text-[#d4a017] mb-4">
                    {doc.fee > 0 ? `₱${doc.fee}.00 fee` : "Free of charge"}
                  </div>
                  <ul className="space-y-2">
                    {doc.requirements.slice(0, 3).map((req) => (
                      <li key={req.requirement} className="flex items-start gap-2 text-sm text-muted-foreground leading-snug">
                        <CheckCircle2 size={17} className="text-emerald-600 shrink-0 mt-0.5" />
                        {req.requirement}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          <div className="text-center mt-14">
            <button
              onClick={onSignIn}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-primary text-white font-semibold text-lg hover:bg-primary/90 transition-colors shadow-sm"
            >
              Sign In to Request a Document <ArrowRight size={20} />
            </button>
          </div>
        </div>
      </section>

      {/* Info: Announcements + About + Contact */}
      <section id="info" className="py-28 px-6 sm:px-10 lg:px-16 bg-[#f0f3f8]">
        <div className="max-w-[1600px] mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 text-primary text-sm font-bold tracking-wide uppercase mb-4">
              <Megaphone size={18} /> Community Info
            </div>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-foreground mb-4" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Announcements & Updates
            </h2>
            <p className="text-muted-foreground text-lg">Stay informed about what's happening in the barangay.</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-6 mb-20">
            {announcements.length === 0 && (
              <div className="sm:col-span-2 text-center text-muted-foreground text-base py-8">No announcements posted yet.</div>
            )}
            {announcements.map((item) => {
              const { icon: Icon, tagColor } = ANNOUNCEMENT_STYLE[item.tag];
              return (
                <div key={item.id} className="bg-card rounded-2xl border border-border p-7 flex gap-5 hover:shadow-md transition-shadow">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon size={28} className="text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5 mb-2 flex-wrap">
                      <span className={`text-sm font-bold px-3 py-1 rounded-full ${tagColor}`}>{item.tag}</span>
                      <span className="text-muted-foreground text-sm">{formatAnnouncementDate(item.date)}</span>
                    </div>
                    <h3 className="font-bold text-foreground mb-1.5 text-lg" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      {item.title}
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{item.body}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Contact & office info */}
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-primary rounded-3xl p-10 text-white relative overflow-hidden">
              <div
                className="absolute -bottom-16 -right-10 w-64 h-64 rounded-full opacity-10"
                style={{ background: "radial-gradient(circle, #d4a017 0%, transparent 70%)" }}
              />
              <h3 className="text-2xl font-bold mb-8 relative" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Get in Touch
              </h3>
              <div className="relative grid sm:grid-cols-2 gap-7">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                    <MapPin size={22} />
                  </div>
                  <div>
                    <div className="text-blue-200 text-sm font-semibold mb-1">Office Address</div>
                    <div className="text-base leading-snug">Barangay Hall, Campagao, City of Bilar</div>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                    <Phone size={22} />
                  </div>
                  <div>
                    <div className="text-blue-200 text-sm font-semibold mb-1">Contact Number</div>
                    <div className="text-base leading-snug">(63) 723-1234 · 0917-123-4567</div>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                    <Mail size={22} />
                  </div>
                  <div>
                    <div className="text-blue-200 text-sm font-semibold mb-1">Email</div>
                    <div className="text-base leading-snug">brgycampagao.office@gmail.com</div>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                    <Clock size={22} />
                  </div>
                  <div>
                    <div className="text-blue-200 text-sm font-semibold mb-1">Office Hours</div>
                    <div className="text-base leading-snug">Mon–Fri, 8:00 AM – 5:00 PM</div>
                  </div>
                </div>
              </div>
              <div className="relative flex items-center gap-3 mt-8 pt-8 border-t border-white/10">
                <Facebook size={20} className="text-blue-200" />
                <span className="text-blue-200 text-base">facebook.com/BarangayCampagaoOfficial</span>
              </div>
            </div>

            <div className="bg-[#c0392b] rounded-3xl p-10 text-white flex flex-col justify-center">
              <div className="w-14 h-14 rounded-xl bg-white/15 flex items-center justify-center mb-5">
                <AlertTriangle size={26} />
              </div>
              <h3 className="text-xl font-bold mb-4" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Emergency Hotlines
              </h3>
              <ul className="space-y-3 text-base">
                <li className="flex justify-between"><span className="text-red-100">Barangay Tanod</span><span className="font-semibold">0958-573-0971</span></li>
                <li className="flex justify-between"><span className="text-red-100">Police (PNP)</span><span className="font-semibold">0998-598-6406</span></li>
                <li className="flex justify-between"><span className="text-red-100">Fire (BFP)</span><span className="font-semibold">0943-248-1295</span></li>
                <li className="flex justify-between"><span className="text-red-100">Barangay Health</span><span className="font-semibold">0938-094-8412</span></li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0d2244] text-blue-200 py-12 px-6 sm:px-10 lg:px-16">
        <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center">
              <BarangayLogo size={44} className="text-white" />
            </div>
            <div className="text-white text-base font-semibold">Barangay Campagao &copy; {new Date().getFullYear()}</div>
          </div>
          <p className="text-sm text-center sm:text-right">
            Protected by the Data Privacy Act of 2012 (R.A. 10173) · All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

const FALLBACK_DOC_TYPES: ApiDocumentType[] = [
  {
    name: "Barangay Clearance",
    fee: 50,
    requirements: [
      { requirement: "Valid Government ID (original + photocopy)", required: true },
      { requirement: "Proof of Residency (utility bill)", required: true },
      { requirement: "1 piece 2x2 ID photo", required: false },
    ],
  },
  {
    name: "Indigency Certificate",
    fee: 0,
    requirements: [
      { requirement: "Valid Government ID (original + photocopy)", required: true },
      { requirement: "Proof of Residency", required: false },
      { requirement: "Accomplished application form", required: false },
    ],
  },
  {
    name: "Residency Certificate",
    fee: 50,
    requirements: [
      { requirement: "Valid Government ID (original + photocopy)", required: true },
      { requirement: "Proof of Residency (at least 6 months)", required: true },
      { requirement: "1 piece 2x2 ID photo", required: false },
    ],
  },
  {
    name: "Business Permit",
    fee: 200,
    requirements: [
      { requirement: "DTI/SEC Registration", required: true },
      { requirement: "Lease Contract or TCT (if owned)", required: true },
      { requirement: "Accomplished application form", required: false },
    ],
  },
  {
    name: "First-Time Job Seeker Certificate",
    fee: 0,
    requirements: [
      { requirement: "Valid Government ID (original + photocopy)", required: true },
      { requirement: "Proof of Residency (at least 6 months)", required: true },
      { requirement: "Accomplished application form", required: false },
    ],
  },
  {
    name: "Certificate of Cohabitation",
    fee: 50,
    requirements: [
      { requirement: "Valid Government ID of both partners (original + photocopy)", required: true },
      { requirement: "Proof of Cohabitation (joint utility bill, lease, or similar)", required: true },
      { requirement: "Accomplished application form", required: false },
    ],
  },
];
