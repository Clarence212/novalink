import React, { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { SiteFooter } from '../components/SiteFooter';

const DOCUMENTS = {
  terms: {
    eyebrow: 'Portal agreement',
    title: 'Terms and Conditions',
    description: 'The rules that apply when residents, guests, security personnel, and administrators use NovaLink.',
    sections: [
      {
        title: '1. Acceptance and purpose',
        paragraphs: [
          'NovaLink is the community management portal of Novaville Homeowners Association, Inc. By accessing or using the portal, you agree to these Terms and Conditions and to applicable NHAI rules, policies, and procedures.',
          'The portal supports community administration, including homeowner account services, dues and payment review, facility reservations, visitor management, vehicle and sticker records, announcements, and resident concerns. NovaLink does not replace official notices or decisions issued directly by NHAI.',
        ],
      },
      {
        title: '2. Accounts and authorized access',
        paragraphs: [
          'You must use only the account assigned to you and provide complete and accurate registration information. Resident accounts may be linked to an existing homeowner record and can remain pending until NHAI completes its verification and approval process.',
          'You are responsible for protecting your password, signing out of shared devices, and promptly informing NHAI if you believe your account has been accessed without permission. You must not share accounts, attempt to assume another person’s identity, or access information outside your assigned role.',
        ],
      },
      {
        title: '3. Requests, records, and approvals',
        paragraphs: [
          'Information submitted through NovaLink must be truthful, current, and relevant to the requested community service. This includes payment details and proof, reservation information, visitor and vehicle records, contact information, and concern submissions.',
          'A successful online submission does not automatically mean approval. NHAI may verify supporting information, request corrections, reject incomplete or duplicate submissions, apply community rules and fees, or cancel requests when necessary for safety, maintenance, scheduling, or association operations.',
        ],
      },
      {
        title: '4. Payments and facility reservations',
        paragraphs: [
          'Payment records shown in NovaLink are subject to NHAI validation and reconciliation. Uploaded payment proof must correspond to a legitimate transaction. Official balances, allocations, and receipts are determined by the association’s verified records.',
          'Facility availability may change while a request is being reviewed. Reservations are subject to capacity, schedules, rates, cancellation rules, community guidelines, and any additional conditions communicated by NHAI.',
        ],
      },
      {
        title: '5. Acceptable use',
        paragraphs: [
          'You must not use NovaLink to submit unlawful, threatening, misleading, abusive, or malicious content. Attempts to disrupt the service, bypass security controls, probe restricted areas, introduce harmful code, scrape protected information, or misuse another person’s data are prohibited.',
          'NHAI may restrict or suspend portal access when reasonably necessary to protect residents, records, system security, or association operations. Serious misuse may be referred to the appropriate authorities or handled under applicable association rules.',
        ],
      },
      {
        title: '6. Availability and changes',
        paragraphs: [
          'NovaLink is provided to support community services and may occasionally be unavailable because of maintenance, updates, network interruptions, security work, or circumstances beyond NHAI’s control. Time-sensitive matters should be confirmed directly with the NHAI office when the portal is unavailable.',
          'NHAI may update the portal and these terms as services change. Material updates should be communicated through the portal or another appropriate association channel. Continued use after an update means the revised terms apply to future portal activity.',
        ],
      },
      {
        title: '7. Contact and questions',
        paragraphs: [
          'Questions about these terms, account access, submitted records, or an NHAI decision should be directed to the association office through its official contact channels. The office may require identity or property verification before discussing protected account information.',
        ],
      },
    ],
  },
  privacy: {
    eyebrow: 'Data and privacy',
    title: 'Privacy Policy',
    description: 'How NovaLink collects, uses, protects, and manages information needed for NHAI community services.',
    sections: [
      {
        title: '1. Scope of this policy',
        paragraphs: [
          'This Privacy Policy applies to personal and community information processed through NovaLink by Novaville Homeowners Association, Inc. It covers residents, homeowners, guests, security personnel, administrators, and other people whose information is entered into the portal for an association service.',
          'Some official NHAI records may also be maintained outside NovaLink. When a portal record differs from an authorized master record, NHAI may review and correct the information after appropriate verification.',
        ],
      },
      {
        title: '2. Information NovaLink processes',
        paragraphs: [
          'NovaLink may process names, email addresses, contact numbers, block and lot details, homeowner-account links, account roles and status, verification records, sign-in and security events, and administrative audit history.',
          'Depending on the service used, the portal may also process dues and payment information, uploaded payment proof, facility reservations, visitor passes and entry records, vehicle and sticker details, announcements, concerns, responses, and related supporting information.',
        ],
      },
      {
        title: '3. How information is used',
        paragraphs: [
          'Information is used to verify identities and homeowner relationships, provide requested community services, administer accounts, evaluate payments and reservations, manage community access, respond to concerns, communicate decisions, and maintain accurate association records.',
          'Technical and audit information is used to protect accounts, investigate errors or suspicious activity, enforce role permissions, diagnose service problems, maintain backups, and demonstrate how important administrative changes were made.',
        ],
      },
      {
        title: '4. Access and disclosure',
        paragraphs: [
          'Portal access is assigned by role. Residents, security personnel, and administrators are shown only the functions and records needed for their responsibilities. Authorized NHAI personnel may access information when required to review a request, correct a record, support a user, protect the system, or perform association duties.',
          'NHAI does not use NovaLink information for third-party advertising. Information may be disclosed when required by applicable law, a valid official request, an emergency involving safety or security, or a service provider arrangement needed to operate the portal with appropriate safeguards.',
        ],
      },
      {
        title: '5. Cookies and session security',
        paragraphs: [
          'NovaLink uses necessary cookies to maintain secure sign-in sessions, protect requests, and remember cookie preferences. These cookies support essential portal functions and are not used for advertising.',
          'A sign-in session ends after logout, browser-session closure, or the configured inactivity period. Users should sign out before leaving a shared or public device.',
        ],
      },
      {
        title: '6. Retention and protection',
        paragraphs: [
          'Records are kept for as long as reasonably needed for community administration, audit, dispute handling, security, continuity, and applicable operational or legal requirements. Retention periods may differ depending on the type and status of a record.',
          'NovaLink uses role-based access, password protections, secure sessions, request validation, audit records, and operational safeguards to reduce unauthorized access or alteration. No system can guarantee absolute security, so suspected incidents should be reported promptly to NHAI.',
        ],
      },
      {
        title: '7. Corrections and privacy requests',
        paragraphs: [
          'Residents may contact the NHAI office to request access to or correction of their account and homeowner information. NHAI may require identity, residence, or ownership verification before acting on a request, and some records may need to be retained when required for legitimate association purposes.',
          'Questions about this policy, a portal record, or the handling of personal information should be sent through official NHAI contact channels. Privacy requests should identify the affected account or record without including passwords or verification codes.',
        ],
      },
      {
        title: '8. Policy updates',
        paragraphs: [
          'This policy may be updated when NovaLink features, association practices, or applicable requirements change. The current version will be made available through the portal, and significant changes should be communicated through an appropriate NHAI channel.',
        ],
      },
    ],
  },
};

export const LegalPage = ({ documentKey }) => {
  const legalDocument = DOCUMENTS[documentKey];

  useEffect(() => {
    document.title = `${legalDocument.title} | NovaLink Portal`;
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [legalDocument.title]);

  return (
    <div className="flex min-h-screen flex-col bg-[#eef2f3] text-slate-700">
      <main id="main-content" className="mx-auto w-full max-w-7xl flex-1 px-6 py-10 sm:px-10 lg:px-12 lg:py-12">
        <article>
          <div className="flex flex-col-reverse gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-700 sm:text-4xl">{legalDocument.title}</h1>
              <p className="mt-2 text-sm font-bold text-slate-700">Last revision September 1, 2026.</p>
            </div>
            <a href="/" className="inline-flex min-h-10 w-fit items-center gap-2 text-sm font-semibold text-blue-700 transition hover:text-blue-900 hover:underline">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to NovaLink
            </a>
          </div>

          <p className="mt-4 max-w-6xl text-[15px] leading-6 text-slate-700">{legalDocument.description}</p>

          <div className="mt-5 space-y-6">
            {legalDocument.sections.map((section) => {
              const sectionId = `${documentKey}-${section.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
              return (
                <section key={section.title} aria-labelledby={sectionId}>
                  <h2 id={sectionId} className="text-xl font-bold text-slate-700 sm:text-2xl">{section.title}</h2>
                  <div className="mt-2 space-y-2.5">
                    {section.paragraphs.map((paragraph) => (
                      <p key={paragraph} className="max-w-6xl text-[15px] leading-6 text-slate-700">{paragraph}</p>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>

          <p className="mt-8 border-t border-slate-300 pt-5 text-sm leading-6 text-slate-600">
            Need clarification or a record correction? Contact the NHAI office through its official community channels. Never include your password or verification code in a message.
          </p>
        </article>
      </main>

      <SiteFooter />
    </div>
  );
};
