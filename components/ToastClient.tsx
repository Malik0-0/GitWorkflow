"use client";

import { Toaster } from "react-hot-toast";

export default function ToastClient() {
  return <Toaster position="top-right" toastOptions={{ duration: 3500 }} />;
}