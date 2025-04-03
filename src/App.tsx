
import { BrowserRouter, Route, Routes } from "react-router-dom"
import { ThemeProvider } from "./components/theme-provider"
import { SolanaProviders } from "./components/SolanaProviders"
import "./App.css"
import { Toaster } from "@/components/ui/toaster"
import NotFound from "./pages/NotFound"
import BundleSimulator from "./components/BundleSimulator"
import Policy from "./pages/Policy"
import TermsConditions from "./pages/TermsConditions"
import Footer from "./components/Footer"

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <SolanaProviders>
        <BrowserRouter>
          <div className="flex flex-col min-h-screen">
            <div className="flex-grow">
              <Routes>
                <Route path="/" element={<BundleSimulator />} />
                <Route path="/policy" element={<Policy />} />
                <Route path="/terms" element={<TermsConditions />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </div>
            <Footer />
          </div>
        </BrowserRouter>
        <Toaster />
      </SolanaProviders>
    </ThemeProvider>
  )
}

export default App
