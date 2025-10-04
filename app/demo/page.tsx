"use client";
import ChatClient from "@/components/ChatClient";

export default function DemoPage() {
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Video */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover z-0"
      >
        <source
          src="https://cdn.prod.website-files.com/67b7abfbb037e687d0a415ec%2F67efea72215981d3ba4e777d_WEBSITE%20VIDEO%203b-transcode.mp4"
          type="video/mp4"
        />
      </video>
      
      {/* Content Overlay */}
      <div className="relative z-10 w-full max-w-3xl p-4">
        <ChatClient />
      </div>
    </div>
  );
}
