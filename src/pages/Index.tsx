import BundleBuilder from "@/components/BundleBuilder";
import { ProtectedRoute } from "@/components/ProtectedRoute";

const Index = () => {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <BundleBuilder />
      </div>
    </ProtectedRoute>
  );
};

export default Index;