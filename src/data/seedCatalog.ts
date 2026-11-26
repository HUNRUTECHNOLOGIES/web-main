import type { ApiPreset, ProjectItem, SiteSettings } from '../types/hunrutech.ts';

export const HERO_WORKSTATION_IMAGE = '/src/assets/images/hero_hunrutech_workstation_1795696507671.jpg';
export const FOUNDER_PORTRAIT_IMAGE = '/src/assets/images/founder_johnmark_avatar_1795696507720.jpg';

export const FLAGSHIP_PROJECTS: Omit<ProjectItem, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'konsole-os',
    slug: 'konsole-os',
    title: 'Konsole-OS',
    summary:
      'Android terminal emulator, keyboard-first launcher, and mobile systems management environment built on Termux and TUI engineering principles.',
    category: 'Software',
    version: 'v2.4.0',
    techStack: ['Java', 'Shell', 'Termux API', 'TUI'],
    repoUrl: 'https://github.com/hunter-zen-RU/Konsole-OS',
    demoUrl: 'https://hunrutech.pythonanywhere.com/konsole-os',
    cloneCommand: 'git clone https://github.com/hunter-zen-RU/Konsole-OS.git',
    imageUrl: '/src/assets/images/project_konsole_os_1795696506975.jpg',
    featured: true,
    visible: true,
  },
  {
    id: 'kali-org-portfolio',
    slug: 'kali-org-portfolio',
    title: 'HUNRUTECH Kali Org Portal',
    summary:
      'Dark-mode cybersecurity portfolio, developer workbench, and operations dashboard bridging hunter-zen-RU and HUNRUTECHNOLOGIES.',
    category: 'Web Apps',
    version: 'v3.1.0',
    techStack: ['Next.js', 'TypeScript', 'Tailwind CSS', 'PostgreSQL'],
    repoUrl: 'https://github.com/HUNRUTECHNOLOGIES/about',
    demoUrl: 'https://hunrutech.pythonanywhere.com',
    cloneCommand: 'git clone https://github.com/HUNRUTECHNOLOGIES/about.git',
    imageUrl: '/src/assets/images/project_kali_portfolio_1795696507348.jpg',
    featured: true,
    visible: true,
  },
  {
    id: 'zero-one-sec-scripts',
    slug: 'zero-one-sec-scripts',
    title: 'Zero-One Security & Recon Scripts',
    summary:
      'Modular ethical hacking, TLS/header verification, and automated infrastructure audit scripts engineered for rapid authorized assessments.',
    category: 'CLI & Automation',
    version: 'v1.8.2',
    techStack: ['Python', 'Bash', 'OpenSSL', 'Puppeteer'],
    repoUrl: 'https://github.com/hunrutech/zero-one-sec-scripts',
    demoUrl: 'https://hunrutech.pythonanywhere.com/sec-scripts',
    cloneCommand: 'git clone https://github.com/hunrutech/zero-one-sec-scripts.git',
    imageUrl: '/src/assets/images/project_sec_scripts_1795696507556.jpg',
    featured: true,
    visible: true,
  },
  {
    id: 'daraja-paystack-cli',
    slug: 'daraja-paystack-cli',
    title: 'Fintech Sandbox & Webhook CLI',
    summary:
      'Developer CLI and payload generator for Safaricom Daraja STK Push, B2C callbacks, and Paystack HMAC-SHA512 webhook verification.',
    category: 'CLI & Automation',
    version: 'v1.4.0',
    techStack: ['TypeScript', 'Node.js', 'Daraja API', 'Paystack'],
    repoUrl: 'https://github.com/hunrutech/fintech-sandbox-cli',
    demoUrl: 'https://hunrutech.pythonanywhere.com/fintech-cli',
    cloneCommand: 'npx @hunrutech/fintech-cli init',
    imageUrl: '/src/assets/images/project_sec_scripts_1795696507556.jpg',
    featured: false,
    visible: true,
  },
  {
    id: 'media-pipeline-ffmpeg',
    slug: 'media-pipeline-ffmpeg',
    title: 'Headless Media & PDF Worker',
    summary:
      'Automated batch transcoding and headless browser snapshot microservice using FFmpeg and Puppeteer for high-throughput SaaS pipelines.',
    category: 'Software',
    version: 'v1.2.5',
    techStack: ['Python', 'FFmpeg', 'Puppeteer', 'Docker'],
    repoUrl: 'https://github.com/hunter-zen-RU/headless-media-worker',
    demoUrl: '',
    cloneCommand: 'git clone https://github.com/hunter-zen-RU/headless-media-worker.git',
    imageUrl: '/src/assets/images/project_kali_portfolio_1795696507348.jpg',
    featured: false,
    visible: true,
  },
];

export const DEFAULT_API_PRESETS: Omit<ApiPreset, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'daraja-oauth-token',
    name: 'Daraja: OAuth Token Generation',
    category: 'Daraja',
    method: 'GET',
    url: 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    headersJson: JSON.stringify(
      {
        Authorization: 'Basic <BASE64_CONSUMER_KEY_AND_SECRET>',
      },
      null,
      2
    ),
    bodyJson: '',
    description: 'Generates a Safaricom Daraja sandbox Bearer access token using Base64 Basic auth.',
    enabled: true,
  },
  {
    id: 'daraja-stk-push',
    name: 'Daraja: STK Push (M-Pesa Express)',
    category: 'Daraja',
    method: 'POST',
    url: 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
    headersJson: JSON.stringify(
      {
        Authorization: 'Bearer <DARAJA_ACCESS_TOKEN>',
        'Content-Type': 'application/json',
      },
      null,
      2
    ),
    bodyJson: JSON.stringify(
      {
        BusinessShortCode: '174379',
        Password: 'MTc0Mzc5YmZiMjc5ZjlhYTliZGJjZjE1OGU5N2RkNzFhNDY3Y2QyZTBjODkzMDU5YjEwZjc4ZTZiNzJhZGExZWQyYzkxOTIwMjYwMTEwMTIwMDAw',
        Timestamp: '20260110120000',
        TransactionType: 'CustomerPayBillOnline',
        Amount: 100,
        PartyA: '254708374149',
        PartyB: '174379',
        PhoneNumber: '254708374149',
        CallBackURL: 'https://example.com/api/mpesa/callback',
        AccountReference: 'HUNRUTECH-TEST',
        TransactionDesc: 'Sandbox STK Push Verification',
      },
      null,
      2
    ),
    description: 'Initiates an M-Pesa Express Lipa Na M-Pesa Online STK prompt on the Daraja sandbox.',
    enabled: true,
  },
  {
    id: 'daraja-b2c-payment',
    name: 'Daraja: C2B / B2C Payout Simulation',
    category: 'Daraja',
    method: 'POST',
    url: 'https://sandbox.safaricom.co.ke/mpesa/b2c/v3/paymentrequest',
    headersJson: JSON.stringify(
      {
        Authorization: 'Bearer <DARAJA_ACCESS_TOKEN>',
        'Content-Type': 'application/json',
      },
      null,
      2
    ),
    bodyJson: JSON.stringify(
      {
        OriginatorConversationID: 'HNRT-B2C-0001',
        InitiatorName: 'testapi',
        SecurityCredential: '<ENCRYPTED_SECURITY_CREDENTIAL>',
        CommandID: 'BusinessPayment',
        Amount: 500,
        PartyA: '600988',
        PartyB: '254708374149',
        Remarks: 'Vendor disbursement test',
        QueueTimeOutURL: 'https://example.com/api/b2c/timeout',
        ResultURL: 'https://example.com/api/b2c/result',
        Occasion: 'WorkbenchTest',
      },
      null,
      2
    ),
    description: 'Tests Safaricom Daraja B2C disbursement payload formatting and auth headers.',
    enabled: true,
  },
  {
    id: 'paystack-init-tx',
    name: 'Paystack: Initialize Transaction',
    category: 'Paystack',
    method: 'POST',
    url: 'https://api.paystack.co/transaction/initialize',
    headersJson: JSON.stringify(
      {
        Authorization: 'Bearer sk_test_xxxxxxxxxxxxxxxxxxxx',
        'Content-Type': 'application/json',
      },
      null,
      2
    ),
    bodyJson: JSON.stringify(
      {
        email: 'developer@hunrutech.dev',
        amount: 500000,
        currency: 'KES',
        reference: 'HNRT_PS_TEST_001',
        callback_url: 'https://example.com/paystack/callback',
      },
      null,
      2
    ),
    description: 'Initializes a Paystack checkout session and returns an authorization_url.',
    enabled: true,
  },
  {
    id: 'paystack-verify-tx',
    name: 'Paystack: Verify Payment',
    category: 'Paystack',
    method: 'GET',
    url: 'https://api.paystack.co/transaction/verify/HNRT_PS_TEST_001',
    headersJson: JSON.stringify(
      {
        Authorization: 'Bearer sk_test_xxxxxxxxxxxxxxxxxxxx',
      },
      null,
      2
    ),
    bodyJson: '',
    description: 'Verifies transaction status, channel, and settlement payload from Paystack.',
    enabled: true,
  },
  {
    id: 'paystack-webhook-sim',
    name: 'Paystack: Webhook Payload Simulator',
    category: 'Paystack',
    method: 'POST',
    url: 'https://httpbin.org/post',
    headersJson: JSON.stringify(
      {
        'Content-Type': 'application/json',
        'x-paystack-signature': '<AUTO_GENERATED_HMAC_SHA512>',
      },
      null,
      2
    ),
    bodyJson: JSON.stringify(
      {
        event: 'charge.success',
        data: {
          id: 302961,
          domain: 'test',
          status: 'success',
          reference: 'HNRT_PS_TEST_001',
          amount: 500000,
          currency: 'KES',
          channel: 'mobile_money',
          customer: {
            email: 'developer@hunrutech.dev',
          },
        },
      },
      null,
      2
    ),
    description: 'Simulates a Paystack charge.success webhook dispatch with real HMAC-SHA512 signing.',
    enabled: true,
  },
  {
    id: 'supabase-rest-query',
    name: 'Supabase: PostgREST Table Query',
    category: 'Supabase',
    method: 'GET',
    url: 'https://your-project-ref.supabase.co/rest/v1/projects?select=*&limit=10',
    headersJson: JSON.stringify(
      {
        apikey: '<SUPABASE_ANON_KEY>',
        Authorization: 'Bearer <SUPABASE_ANON_KEY>',
      },
      null,
      2
    ),
    bodyJson: '',
    description: 'Queries a Supabase PostgreSQL table over PostgREST with apikey & Bearer headers.',
    enabled: true,
  },
  {
    id: 'supabase-rpc-call',
    name: 'Supabase: RPC Function Call',
    category: 'Supabase',
    method: 'POST',
    url: 'https://your-project-ref.supabase.co/rest/v1/rpc/get_system_health',
    headersJson: JSON.stringify(
      {
        apikey: '<SUPABASE_ANON_KEY>',
        Authorization: 'Bearer <SUPABASE_ANON_KEY>',
        'Content-Type': 'application/json',
      },
      null,
      2
    ),
    bodyJson: JSON.stringify(
      {
        include_metrics: true,
      },
      null,
      2
    ),
    description: 'Invokes a PostgreSQL stored procedure via Supabase RPC endpoint.',
    enabled: true,
  },
];

export const DEFAULT_SITE_SETTINGS: Omit<SiteSettings, 'updatedAt'> = {
  announcementText: 'Konsole-OS v2.4.0 & HUNRUTECH DevTools Workbench are live — explore the API & SMTP sandbox.',
  announcementActive: false,
  maintenanceMode: false,
  proxyRateLimitPerMin: 30,
  smtpRateLimitPerMin: 6,
  enabledDevTools: [
    'api-tester',
    'smtp-tester',
    'jwt-decoder',
    'hash-base64',
    'json-formatter',
    'password-gen',
    'qr-scanner',
    'syntax-visualizer',
  ],
};

export const TECH_STACK_MATRIX = [
  {
    group: 'Languages',
    items: ['C', 'Java', 'Python', 'JS / TS', 'PHP'],
  },
  {
    group: 'Frameworks & Tools',
    items: ['Next.js', 'Tailwind CSS', '.NET', 'Prisma', 'Puppeteer', 'FFmpeg', 'Web3.js'],
  },
  {
    group: 'Databases & Cloud',
    items: ['PostgreSQL', 'MySQL', 'MongoDB', 'Supabase', 'Firebase', 'Vercel', 'Render'],
  },
  {
    group: 'Design & Game Dev',
    items: ['Figma', 'Adobe CC', 'Blender', 'Unity', 'Unreal Engine', 'Godot'],
  },
];

export const SOCIAL_ECOSYSTEM_LINKS = [
  { label: 'GitHub (@hunter-zen-RU)', href: 'https://github.com/hunter-zen-RU' },
  { label: 'GitHub (@hunrutech)', href: 'https://github.com/hunrutech' },
  { label: 'GitHub (@HUNRUTECHNOLOGIES)', href: 'https://github.com/HUNRUTECHNOLOGIES' },
  { label: 'LinkedIn', href: 'https://linkedin.com/company/hunrutechnologies' },
  { label: 'X (Twitter)', href: 'https://x.com/hunrutech' },
  { label: 'Discord (Zero One)', href: 'https://discord.com' },
  { label: 'Behance', href: 'https://behance.net/hunrutech' },
  { label: 'YouTube', href: 'https://youtube.com/@hunrutech' },
];

export const SUPPORT_LINKS = [
  { label: 'BuyMeACoffee', href: 'https://buymeacoffee.com/hunrutech' },
  { label: 'PayPal', href: 'https://paypal.me/hunrutech' },
  { label: 'Patreon', href: 'https://patreon.com/hunrutech' },
  { label: 'Ko-Fi', href: 'https://ko-fi.com/hunrutech' },
];
