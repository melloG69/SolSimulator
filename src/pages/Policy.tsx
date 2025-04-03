
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const Policy = () => {
  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <Link to="/">
        <Button variant="ghost" className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Button>
      </Link>
      
      <Card>
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl">Privacy Policy</CardTitle>
          </div>
          <CardDescription>Last updated: April 3, 2025</CardDescription>
        </CardHeader>
        
        <CardContent className="text-left space-y-6">
          <section>
            <h3 className="text-xl font-medium mb-3">Introduction</h3>
            <p className="text-muted-foreground">
              This Privacy Policy describes how we collect, use, and disclose your information when you use our Jito Bundle Guardrail service with Lighthouse integration. We are committed to protecting your privacy and ensuring the security of your personal information.
            </p>
          </section>
          
          <Separator />
          
          <section>
            <h3 className="text-xl font-medium mb-3">Information We Collect</h3>
            <p className="text-muted-foreground mb-3">
              When you use our service, we may collect the following types of information:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Wallet addresses used for interacting with our service</li>
              <li>Transaction data processed through our bundle simulator</li>
              <li>Metadata related to Lighthouse assertions</li>
              <li>IP addresses and basic device information for security purposes</li>
              <li>Usage patterns and interaction with our application</li>
            </ul>
          </section>
          
          <Separator />
          
          <section>
            <h3 className="text-xl font-medium mb-3">How We Use Your Information</h3>
            <p className="text-muted-foreground mb-3">
              We use the collected information for the following purposes:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Providing and maintaining our service</li>
              <li>Processing transaction bundles and Lighthouse assertions</li>
              <li>Improving and optimizing our application</li>
              <li>Detecting and preventing potential fraud or abuse</li>
              <li>Communicating with you about service updates or issues</li>
              <li>Complying with legal obligations</li>
            </ul>
          </section>
          
          <Separator />
          
          <section>
            <h3 className="text-xl font-medium mb-3">Data Security</h3>
            <p className="text-muted-foreground">
              We implement appropriate security measures to protect your information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the Internet or electronic storage is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>
          
          <Separator />
          
          <section>
            <h3 className="text-xl font-medium mb-3">Contact Us</h3>
            <p className="text-muted-foreground">
              If you have any questions or concerns about this Privacy Policy, please contact us at privacy@example.com.
            </p>
          </section>
          
          <div className="pt-4">
            <Link to="/terms" className="text-primary hover:underline">
              View our Terms & Conditions
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Policy;
