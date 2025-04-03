
import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="py-4 mt-4 border-t border-border">
      <div className="container flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-muted-foreground">
        <span>© 2025 Lighthouse Bundle Guardrail</span>
        <div className="flex gap-4">
          <Link to="/policy" className="hover:text-primary hover:underline">
            Privacy Policy
          </Link>
          <Link to="/terms" className="hover:text-primary hover:underline">
            Terms & Conditions
          </Link>
          <a 
            href="https://www.lighthouse.voyage/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary hover:underline"
          >
            Lighthouse
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
