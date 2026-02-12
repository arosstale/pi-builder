# Pi Builder: Strategic Overview

## Why We're Building This

### The Auto Maker Problem

Auto Maker has a **custom restrictive license** that prevents:

1. **Monetization** - Can't sell it or SaaS it without Core Contributor unanimous vote
2. **Hosting as Service** - Can't deploy as cloud app
3. **Forks/Derivatives** - Can't build commercial products on it
4. **Commercial Use** - Severely limited despite being "open source"
5. **Core Contributor Gate** - 4 people control everything

**From their LICENSE:**
```
"Monetization" means any activity that generates revenue, income, or 
commercial benefit from the Software itself or any Derivative Work...
Reselling, redistributing, or sublicensing...Hosting the Software 
as a service...requires unanimous vote by all Core Contributors
```

### The Pi Builder Answer

**MIT License** = **Full Freedom**

- ✅ Use commercially without asking permission
- ✅ Build SaaS products on top
- ✅ Fork and modify freely
- ✅ Build products and sell them
- ✅ Host anywhere (your servers, cloud, SaaS)
- ✅ Monetize any way you want
- ✅ No committee approval needed

## Competitive Advantages

| Feature | Auto Maker | Pi Builder |
|---------|-----------|-----------|
| **License Type** | Custom (restrictive) | MIT (permissive) |
| **Monetization** | Requires unanimous vote | Completely free |
| **SaaS/Hosting** | Explicitly forbidden | Explicitly allowed |
| **Commercial Forks** | Not allowed | Encouraged |
| **Platforms** | Electron only | Web + Desktop + Mobile + CLI |
| **AI Provider** | Hard-coded Claude | Pluggable (Claude, OpenAI, custom) |
| **Code Ownership** | Contributors lose rights* | You keep yours |
| **Business Model** | ??? (licensing fees) | Your choice |

*Auto Maker requires "Full Ownership Transfer & Rights Assignment" from all contributors. They give up all rights.

## 5-Year Vision

### Phase 1 (Now) ✅
- Foundation with core packages
- Web UI scaffolding
- CLI foundation
- Desktop app setup

### Phase 2 (Month 1-2)
- Functional web UI with code generation
- Working CLI for automation
- Real Claude API integration
- Project templates

### Phase 3 (Month 3-4)
- Mobile app (React Native)
- Marketplace for templates
- Community contributions
- Custom LLM support

### Phase 4 (Month 5-12)
- SaaS platform (if we want)
- Enterprise features
- Advanced workflows
- Ecosystem tooling

### Phase 5+ (Year 2+)
- Whatever we want, however we want
- No permission needed
- No restrictions

## Business Models (All Viable Now)

### Open Source (Today)
- Free core product
- Community-driven
- Sponsorships
- Commercial support

### SaaS
- Hosted version on our servers
- Premium features
- Pro/Enterprise tiers
- Analytics dashboard

### Enterprise Licensing
- Self-hosted licenses
- Custom integrations
- Dedicated support
- White-label versions

### Marketplace
- Sell templates
- Sell plugins
- Premium components
- Custom workflows

### Support & Services
- Consulting
- Implementation
- Training
- Agency services

**All of these are blocked with Auto Maker's license.** Zero options.

## Technical Strategy

### Modularity First
Each platform (web, desktop, CLI, mobile) is independent but shares:
- Core engine (`@pi-builder/core`)
- Type definitions (`@pi-builder/types`)
- Utilities (`@pi-builder/utils`)
- AI prompts (`@pi-builder/prompts`)

### Platform Independence
- Web: Next.js (fast, scalable)
- Desktop: Electron + Tauri (both support, choose later)
- Mobile: React Native (iOS + Android)
- CLI: Node.js (automation friendly)

### AI Integration
- Start with Claude (best results)
- Support OpenAI APIs
- Pluggable provider system
- Local model support later

### Monorepo Approach
- npm workspaces for dependency management
- Shared CI/CD
- Single version control
- Easy cross-package refactoring

## Timeline

| Milestone | Timeline | Deliverable |
|-----------|----------|-------------|
| Foundation | ✅ Done | Monorepo, packages, CLI scaffold |
| Basic Web UI | Week 1-2 | Interface for code generation |
| Claude Integration | Week 2-3 | Working AI-powered generation |
| CLI Tools | Week 3-4 | `pi init`, `pi generate`, `pi build` |
| Project Templates | Week 4-5 | Starter kits for popular frameworks |
| Desktop App | Week 5-8 | Electron app for Windows/Mac/Linux |
| Mobile App | Month 2-3 | React Native for iOS/Android |
| Marketplace | Month 3-4 | Community templates & extensions |
| SaaS Platform | Month 4-6 | Hosted version if desired |

## Success Metrics

- GitHub stars/forks
- Community contributions
- Plugin/template ecosystem
- User testimonials
- Monetization ($)
- Market adoption

## Risks & Mitigation

| Risk | Mitigation |
|------|-----------|
| Auto Maker becomes open source | Unlikely; their business model requires control |
| Community forks our code | Good! That's the point |
| License confusion | Clear docs + FAQs |
| Feature parity with Auto Maker | We have better architecture |
| Dependency on Claude API | Support multiple AI providers |

## Our Edge

1. **Freedom**: No license restrictions
2. **Architecture**: Better designed from scratch
3. **Multi-platform**: Not just Electron
4. **Community**: MIT = easier contributions
5. **Business**: Can monetize however we want
6. **Transparency**: Open licensing = trust
7. **Speed**: New project = fast iteration

## Next 30 Days

- ✅ Foundation complete
- [ ] Web UI with basic generation
- [ ] CLI working
- [ ] Claude API integration
- [ ] First templates
- [ ] Community launch (Reddit, HN, etc.)
- [ ] Early adopters onboarded

---

**TL;DR**: We're building what Auto Maker should have been. Better license, better architecture, better freedom.
