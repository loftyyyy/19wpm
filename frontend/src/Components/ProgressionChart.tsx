import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
  { name: 'Day 1', wpm: 65, accuracy: 92 },
  { name: 'Day 2', wpm: 72, accuracy: 94 },
  { name: 'Day 3', wpm: 68, accuracy: 91 },
  { name: 'Day 4', wpm: 78, accuracy: 95 },
  { name: 'Day 5', wpm: 75, accuracy: 93 },
  { name: 'Day 6', wpm: 82, accuracy: 96 },
  { name: 'Day 7', wpm: 80, accuracy: 94 },
  { name: 'Day 8', wpm: 88, accuracy: 97 },
  { name: 'Day 9', wpm: 92, accuracy: 98 },
  { name: 'Day 10', wpm: 95, accuracy: 99 },
];

export default function ProgressionChart() {
  const [activeTab, setActiveTab] = useState('wpm');

  return (
    <div className="mt-10 ml-[155px]">
      <div className="flex flex-col rounded-[10px] shadow-md bg-[#F6EBEA] w-270 h-100">
        <div className="flex flex-row p-8 items-center">
          <h1 className="text-[24px] text-[#1F1A1A] font-semibold" style={{ fontFamily: 'Montserrat' }}>
            Progression
          </h1>
          <div className="flex ml-auto gap-5">
            <button
              onClick={() => setActiveTab('wpm')}
              className={`text-[16px] font-semibold transition-colors ${
                activeTab === 'wpm'
                  ? 'text-[#82524D] underline underline-offset-4'
                  : 'text-[#514442] hover:text-[#82524D] hover:underline hover:underline-offset-4'
              }`}
              style={{ fontFamily: 'Inter' }}
            >
              WPM
            </button>
            <button
              onClick={() => setActiveTab('accuracy')}
              className={`text-[16px] font-semibold transition-colors ${
                activeTab === 'accuracy'
                  ? 'text-[#82524D] underline underline-offset-4'
                  : 'text-[#514442] hover:text-[#82524D] hover:underline hover:underline-offset-4'
              }`}
              style={{ fontFamily: 'Inter' }}
            >
              Accuracy
            </button>
          </div>
        </div>
        <div className="flex-1 px-8 pb-8">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8DDD9" />
              <XAxis dataKey="name" stroke="#514442" />
              <YAxis stroke="#514442" />
              <Tooltip
                contentStyle={{ backgroundColor: '#F6EBEA', border: '1px solid #E8DDD9', borderRadius: '8px' }}
                labelStyle={{ color: '#514442' }}
              />
              {activeTab === 'wpm' ? (
                <Bar dataKey="wpm" fill="#C99B94" radius={[8, 8, 0, 0]} />
              ) : (
                <Bar dataKey="accuracy" fill="#3D6658" radius={[8, 8, 0, 0]} />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
