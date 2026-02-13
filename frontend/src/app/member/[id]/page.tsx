'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';

type MemberData = {
  details: any;
  bills: any[];
  votes: any[];
};

export default function MemberDashboard({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const bioguideId = resolvedParams.id;
  
  const [data, setData] = useState<MemberData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const response = await fetch(`http://localhost:8000/member/${bioguideId}`);
        if (!response.ok) throw new Error('Failed to fetch representative details');
        const result = await response.json();
        setData(result);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }
    fetchDashboard();
  }, [bioguideId]);

  if (isLoading) return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );

  if (error || !data) return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md">
        <h2 className="text-2xl font-bold text-red-600 mb-4">Oops!</h2>
        <p className="text-gray-700 mb-6">{error || "Could not find representative data."}</p>
        <Link href="/" className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors">
          Return to Search
        </Link>
      </div>
    </div>
  );

  const { details, bills, votes } = data;

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Header */}
      <header className="bg-blue-600 text-white py-8 shadow-lg">
        <div className="container mx-auto px-4 max-w-5xl flex flex-col md:flex-row items-center gap-8">
          {details.depiction?.imageUrl && (
            <img 
              src={details.depiction.imageUrl} 
              alt={details.directOrderName}
              className="w-32 h-32 rounded-full border-4 border-white shadow-xl bg-gray-200 object-cover"
            />
          )}
          <div className="text-center md:text-left flex-1">
            <h1 className="text-4xl font-bold mb-2">{details.directOrderName}</h1>
            <p className="text-xl opacity-90 font-medium">
              {details.partyHistory?.[0]?.partyName} &bull; {details.state} {details.terms?.[0]?.district ? `(District ${details.terms[0].district})` : 'Senator'}
            </p>
            <div className="mt-4 flex flex-wrap gap-3 justify-center md:justify-start">
              <a href={details.officialWebsiteUrl} target="_blank" rel="noreferrer" className="bg-white text-blue-600 px-4 py-1.5 rounded-full text-sm font-bold hover:bg-gray-100 transition-colors">
                Official Website
              </a>
              <Link href="/" className="bg-blue-700 text-white border border-blue-400 px-4 py-1.5 rounded-full text-sm font-bold hover:bg-blue-800 transition-colors">
                Back to Chat
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 max-w-5xl mt-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Bio Section */}
        <section className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border">
            <h2 className="text-xl font-bold text-black border-b pb-3 mb-4">Profile Info</h2>
            <dl className="space-y-4">
              <div>
                <dt className="text-xs font-bold text-blue-600 uppercase tracking-wider">Birth Year</dt>
                <dd className="text-black text-lg">{details.birthYear || 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold text-blue-600 uppercase tracking-wider">Current Term</dt>
                <dd className="text-black text-lg">{details.terms?.[details.terms.length - 1]?.congress}th Congress</dd>
              </div>
              <div>
                <dt className="text-xs font-bold text-blue-600 uppercase tracking-wider">Office Address</dt>
                <dd className="text-black text-sm">{details.addressInformation?.officeAddress || 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold text-blue-600 uppercase tracking-wider">Phone</dt>
                <dd className="text-black text-lg">{details.addressInformation?.phoneNumber || 'N/A'}</dd>
              </div>
            </dl>
          </div>
        </section>

        {/* Dynamic Content Sections */}
        <div className="lg:col-span-2 space-y-10">
          {/* Recent Votes */}
          <section className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <h2 className="text-xl font-bold text-black p-6 bg-gray-50 border-b">Recent House Votes</h2>
            <div className="divide-y">
              {votes.length > 0 ? votes.map((v, i) => (
                <div key={i} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded">
                      Legislation: {v.legislation}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(v.date).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-black text-sm font-medium mb-4">{v.question}</p>
                  <div className="flex gap-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-gray-400">Representative Voted</span>
                      <span className={`text-lg font-black ${v.vote === 'Yea' ? 'text-green-600' : v.vote === 'Nay' ? 'text-red-600' : 'text-gray-600'}`}>
                        {v.vote}
                      </span>
                    </div>
                    <div className="flex flex-col border-l pl-4">
                      <span className="text-[10px] uppercase font-bold text-gray-400">Final Outcome</span>
                      <span className="text-lg font-bold text-black">{v.result}</span>
                    </div>
                  </div>
                </div>
              )) : (
                <p className="p-6 text-gray-500 italic">No recent House roll call votes found for this member.</p>
              )}
            </div>
          </section>

          {/* Sponsored Bills */}
          <section className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <h2 className="text-xl font-bold text-black p-6 bg-gray-50 border-b">Recently Sponsored Legislation</h2>
            <div className="divide-y">
              {bills.length > 0 ? bills.map((bill, i) => (
                <div key={i} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-blue-600">
                      {bill.type}{bill.number}
                    </span>
                    <span className="text-xs text-gray-500">
                      Introduced: {bill.introducedDate}
                    </span>
                  </div>
                  <p className="text-black text-sm font-medium mb-3">{bill.title}</p>
                  {bill.latestAction && (
                    <div className="bg-yellow-50 p-3 rounded-md border border-yellow-100">
                      <span className="text-[10px] uppercase font-bold text-yellow-700 block mb-1">Latest Action</span>
                      <p className="text-xs text-yellow-900">{bill.latestAction.text}</p>
                    </div>
                  )}
                </div>
              )) : (
                <p className="p-6 text-gray-500 italic">No sponsored legislation found.</p>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
