
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const TermsConditions = () => {
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
            <FileText className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl">Terms & Conditions</CardTitle>
          </div>
          <CardDescription>Last updated: April 3, 2025</CardDescription>
        </CardHeader>
        
        <CardContent className="text-left space-y-6">
          <section>
            <h3 className="text-xl font-medium mb-3">Introduction</h3>
            <p className="text-muted-foreground">
              These Terms and Conditions govern your use of our Jito Bundle Guardrail service with Lighthouse integration. By accessing or using our service, you agree to be bound by these Terms.
            </p>
          </section>
          
          <Separator />
          
          <section>
            <h3 className="text-xl font-medium mb-3">Service Description</h3>
            <p className="text-muted-foreground">
              Our service provides a bundle simulation environment that includes Lighthouse assertion transactions to protect against malicious state changes. The service helps wallet providers build bundles of transactions with built-in security mechanisms.
            </p>
          </section>
          
          <Separator />
          
          <section>
            <h3 className="text-xl font-medium mb-3">User Responsibilities</h3>
            <p className="text-muted-foreground mb-3">
              As a user of our service, you agree to:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Use the service in compliance with all applicable laws and regulations</li>
              <li>Maintain the security of your wallet and credentials</li>
              <li>Accept responsibility for all activities conducted through your wallet</li>
              <li>Not attempt to bypass or disable any security features</li>
              <li>Not use the service for any illegal or unauthorized purposes</li>
              <li>Not interfere with or disrupt the service or servers</li>
            </ul>
          </section>
          
          <Separator />
          
          <section>
            <h3 className="text-xl font-medium mb-3">Limitation of Liability</h3>
            <p className="text-muted-foreground">
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND. TO THE FULLEST EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES.
            </p>
          </section>
          
          <Separator />
          
          <section>
            <h3 className="text-xl font-medium mb-3">Blockchain Risks</h3>
            <p className="text-muted-foreground">
              You acknowledge that blockchain technology and cryptocurrencies involve significant risks, including price volatility, regulatory uncertainty, and technical vulnerabilities. We do not guarantee the security of the Solana blockchain, Jito bundle processing, or Lighthouse assertions. You accept full responsibility for evaluating these risks.
            </p>
          </section>
          
          <Separator />
          
          <section>
            <h3 className="text-xl font-medium mb-3">Modifications to Terms</h3>
            <p className="text-muted-foreground">
              We may modify these Terms at any time by posting the revised terms on our website. Your continued use of the service after such changes constitutes your acceptance of the new Terms.
            </p>
          </section>
          
          <Separator />
          
          <section>
            <h3 className="text-xl font-medium mb-3">Governing Law</h3>
            <p className="text-muted-foreground">
              These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which our company is registered, without regard to its conflict of law provisions.
            </p>
          </section>
          
          <div className="pt-4">
            <Link to="/policy" className="text-primary hover:underline">
              View our Privacy Policy
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TermsConditions;
