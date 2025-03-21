
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { ThemeProvider } from "./components/theme-provider"
import SolanaProviders from "./components/SolanaProviders"
import "./App.css"
import { Toaster } from "@/components/ui/toaster"
import NotFound from "./pages/NotFound"
import BundleSimulator from "./components/BundleSimulator"

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <SolanaProviders>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<BundleSimulator />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        <Toaster />
      </SolanaProviders>
    </ThemeProvider>
  )
}

export default App
