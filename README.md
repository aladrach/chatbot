# Incorta Chatbot

An embeddable, responsive chatbot interface built with Next.js that provides AI-powered assistance for Incorta documentation and support.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Features

- **Embeddable Design**: Optimized for integration into any website or application
- **Fully Responsive**: Adapts to any container size, from mobile to desktop
- **Real-time Streaming**: Live response streaming with typing animations
- **Source Citations**: Provides references and related questions
- **Dark Mode Support**: Automatic dark/light theme support
- **Mobile Optimized**: Touch-friendly interface for mobile devices
- **Analytics Dashboard**: Password-protected analytics with comprehensive metrics

## Embedding the Chatbot

The chatbot is designed to be easily embedded in various contexts:

### 1. iframe Embedding

```html
<iframe 
    src="http://your-domain.com" 
    width="400px" 
    height="600px"
    style="border: none; border-radius: 8px;"
></iframe>
```

### 2. Responsive Container

```html
<div style="width: 100%; height: 500px;">
    <iframe 
        src="http://your-domain.com" 
        width="100%" 
        height="100%"
        style="border: none;"
    ></iframe>
</div>
```

### 3. Floating Chat Widget

```html
<div style="position: fixed; bottom: 20px; right: 20px; width: 350px; height: 500px;">
    <iframe 
        src="http://your-domain.com" 
        width="100%" 
        height="100%"
        style="border: none; border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,0.12);"
    ></iframe>
</div>
```

### 4. React/Next.js Integration

For direct integration into React applications, you can import and use the components directly.

## Responsive Breakpoints

The chatbot automatically adapts to different screen sizes:

- **Desktop**: Full-featured interface with all elements visible
- **Tablet** (≤768px): Optimized spacing and button sizes
- **Mobile** (≤480px): Compact message bubbles and simplified UI
- **Small Containers** (≤300px height): Ultra-compact mode

## Example Implementation

See `embedding-example.html` for a complete example showing different embedding methods including:
- Sidebar integration
- Floating chat widget
- Full-page embedding
- Responsive layouts

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Analytics Dashboard

The chatbot includes a comprehensive, password-protected analytics dashboard to track usage and performance.

### Setup Analytics

1. **Set up Neon Database**:
   - Sign up at [neon.tech](https://neon.tech)
   - Create a new project
   - Copy your connection string

2. **Initialize Database**:
   - Open Neon SQL Editor
   - Run the SQL from `lib/schema.sql`

3. **Configure Environment Variables**:
   Create `.env.local` (use `env.example` as template):
   ```env
   DATABASE_URL=postgresql://username:password@host/database?sslmode=require
   ANALYTICS_USERNAME=admin
   ANALYTICS_PASSWORD=your-secure-password
   ```

4. **Install Dependencies**:
   ```bash
   pnpm install
   ```

5. **Deploy to Vercel**:
   - Add the same environment variables in Vercel dashboard
   - Settings → Environment Variables

### Accessing Analytics

Visit `/analytics` on your site and login with your credentials.

### Analytics Features

- **Summary Metrics**: Total interactions, avg response time, error rate, sources per response
- **Top Questions**: Most frequently asked questions with visual charts
- **Topic Distribution**: Auto-categorized questions (Authentication, API, Data, Security, etc.)
- **Daily Engagement**: Track interactions and unique sessions over time
- **Date Filters**: View data for last 7 days, 30 days, or all time

### What's Tracked

Every chat interaction automatically tracks:
- Question and answer text
- Response time
- Error status
- Number of sources provided
- Related questions count
- Session ID (unique per user)
- User agent and referrer

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
