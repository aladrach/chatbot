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

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
