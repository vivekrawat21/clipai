"use client";

import { useState } from "react";

export default function Home() {
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");

  async function submitVideo() {
    setMessage("Submitting...");

    try {
      const response = await fetch("http://127.0.0.1:8000/api/videos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
        }),
      });

      const data = await response.json();

      setMessage(data.message);
    } catch (error) {
      console.error(error);
      setMessage("Something went wrong");
    }
  }

  return (
    <main className="min-h-screen p-10">
      <h1 className="text-3xl font-bold">Clip AI</h1>

      <div className="mt-10 max-w-xl">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste YouTube URL"
          className="w-full rounded border p-3"
        />

        <button
          onClick={submitVideo}
          className="mt-4 rounded bg-black px-5 py-3 text-white"
        >
          Analyze Video
        </button>

        <p className="mt-5">{message}</p>
      </div>
    </main>
  );
}
