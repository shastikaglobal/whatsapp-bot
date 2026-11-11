import React from 'react';

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white p-8 rounded-lg shadow">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Privacy Policy</h1>
        
        <div className="space-y-6 text-gray-700">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Introduction</h2>
            <p>Welcome to our Privacy Policy. This document explains how we collect, use, and protect your personal information when you use our WhatsApp Business API integration services.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Information We Collect</h2>
            <p>We collect information necessary to provide our WhatsApp messaging services, which may include:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Contact information (such as name and phone number)</li>
              <li>Message content and metadata processed through the WhatsApp Business API</li>
              <li>Account and billing information</li>
              <li>Usage data and analytics</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. How We Use Your Information</h2>
            <p>Your information is used primarily to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Facilitate messaging via the WhatsApp Business API</li>
              <li>Provide customer support and improve our services</li>
              <li>Ensure the security and integrity of our platform</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Data Sharing and Third Parties</h2>
            <p>We do not sell your personal information. We share data only with:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Meta Platforms, Inc. (as required to operate the WhatsApp Business API)</li>
              <li>Service providers essential to operating our platform (e.g., cloud hosting)</li>
              <li>Law enforcement when legally required</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Data Security</h2>
            <p>We implement industry-standard security measures to protect your data from unauthorized access, alteration, or disclosure. However, no method of transmission over the Internet is 100% secure.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Contact Us</h2>
            <p>If you have any questions or concerns about this Privacy Policy, please contact our support team.</p>
          </section>

          <div className="pt-6 border-t border-gray-200 text-sm text-gray-500">
            Last updated: {new Date().toLocaleDateString()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
