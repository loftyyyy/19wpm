const historyData = [
  {
    id: 1,
    title: "Moby Dick (Excerpt)",
    author: "Herman Melville",
    wpm: 88.2,
    accuracy: "98%",
    duration: "1:45",
    date: "Today",
  },
  {
    id: 2,
    title: "The Catcher in the Rye",
    author: "J.D. Salinger",
    wpm: 91.5,
    accuracy: "100%",
    duration: "0:58",
    date: "Yesterday",
  },
  {
    id: 3,
    title: "1984 (Opening)",
    author: "George Orwell",
    wpm: 82.0,
    accuracy: "96%",
    duration: "2:15",
    date: "Oct 24",
  },
  {
    id: 4,
    title: "Top 100 Common Words",
    author: "Practice Mode",
    wpm: 105.4,
    accuracy: "99%",
    duration: "0:30",
    date: "Oct 22",
  },
];

export default function RecentHistory() {
  return (
    // RECENT HISTORY TABLE
    <div className="mt-10 ml-[155px] mr-[155px]">
      <div className="flex flex-col rounded-[10px] shadow-md bg-[#F6EBEA] w-270">
        <div className="flex flex-row p-8 items-center">
          <h1 className="text-[24px] text-[#1F1A1A] font-semibold" style={{ fontFamily: 'Montserrat' }}>
            Recent History
          </h1>
        </div>
        <div className="px-8 pb-8 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#E8DDD9] text-left">
                <th className="pb-4 text-[14px] font-semibold text-[#514442]" style={{ fontFamily: 'Inter' }}>
                  Text
                </th>
                <th className="pb-4 text-[14px] font-semibold text-[#514442]" style={{ fontFamily: 'Inter' }}>
                  WPM
                </th>
                <th className="pb-4 text-[14px] font-semibold text-[#514442]" style={{ fontFamily: 'Inter' }}>
                  Accuracy
                </th>
                <th className="pb-4 text-[14px] font-semibold text-[#514442]" style={{ fontFamily: 'Inter' }}>
                  Duration
                </th>
                <th className="pb-4 text-[14px] font-semibold text-[#514442]" style={{ fontFamily: 'Inter' }}>
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {historyData.map((item) => (
                <tr key={item.id} className="border-b border-[#E8DDD9] hover:bg-[#f0e4e1] transition-colors">
                  <td className="py-6 text-[16px] text-[#1F1A1A]" style={{ fontFamily: 'Inter' }}>
                    <div className="font-semibold">{item.title}</div>
                    <div className="text-[14px] text-[#514442]">{item.author}</div>
                  </td>
                  <td className="py-6 text-[16px] font-semibold text-[#82524D]" style={{ fontFamily: 'Inter' }}>
                    {item.wpm}
                  </td>
                  <td className="py-6 text-[16px] text-[#514442]" style={{ fontFamily: 'Inter' }}>
                    {item.accuracy}
                  </td>
                  <td className="py-6 text-[16px] text-[#514442]" style={{ fontFamily: 'Inter' }}>
                    {item.duration}
                  </td>
                  <td className="py-6 text-[16px] text-[#514442]" style={{ fontFamily: 'Inter' }}>
                    {item.date}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}