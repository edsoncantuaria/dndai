import React, { useState } from 'react';
import { Icons } from './Icons';

type Tab = 'inventory' | 'character' | 'spells' | 'progression' | 'relationships' | 'journal';

interface MobileToolbarProps {
    activeTab: Tab;
    setActiveTab: (tab: Tab) => void;
    children: React.ReactNode;
}

const MobileToolbar: React.FC<MobileToolbarProps> = ({ activeTab, setActiveTab, children }) => {
    const [isOpen, setIsOpen] = useState(false);

    const toggleOpen = () => setIsOpen(!isOpen);

    const handleTabClick = (tab: Tab) => {
        setActiveTab(tab);
        setIsOpen(true);
    };

    return (
        <>
            {/* Backdrop */}
            {isOpen && <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={toggleOpen}></div>}

            {/* Content Sheet */}
            <div className={`fixed bottom-16 left-0 right-0 z-40 md:hidden transition-transform duration-300 ease-in-out ${isOpen ? 'translate-y-0' : 'translate-y-[calc(100%)]'}`}>
                <div className="bg-stone-800/80 backdrop-blur-md rounded-t-lg border-t border-stone-600">
                     <button onClick={toggleOpen} className="w-full flex justify-center items-center py-2">
                       <div className="w-8 h-1 bg-stone-600 rounded-full"></div>
                    </button>
                    <div className="max-h-[calc(85vh-4rem)] overflow-y-auto p-4">
                      {children}
                    </div>
                </div>
            </div>


            {/* Toolbar */}
            <div className="fixed bottom-0 left-0 right-0 bg-stone-900 border-t border-stone-700 p-2 grid grid-cols-6 items-center md:hidden z-50 h-16">
                 <button onClick={() => handleTabClick('character')} className={`flex justify-center p-2 rounded-md transition-colors ${activeTab === 'character' && isOpen ? 'text-amber-400 bg-amber-500/10' : 'text-stone-400'}`}>
                    <Icons.User />
                </button>
                 <button onClick={() => handleTabClick('inventory')} className={`flex justify-center p-2 rounded-md transition-colors ${activeTab === 'inventory' && isOpen ? 'text-amber-400 bg-amber-500/10' : 'text-stone-400'}`}>
                    <Icons.Backpack />
                </button>
                <button onClick={() => handleTabClick('spells')} className={`flex justify-center p-2 rounded-md transition-colors ${activeTab === 'spells' && isOpen ? 'text-amber-400 bg-amber-500/10' : 'text-stone-400'}`}>
                    <Icons.Book />
                </button>
                <button onClick={() => handleTabClick('relationships')} className={`flex justify-center p-2 rounded-md transition-colors ${activeTab === 'relationships' && isOpen ? 'text-amber-400 bg-amber-500/10' : 'text-stone-400'}`}>
                    <Icons.Users />
                </button>
                <button onClick={() => handleTabClick('journal')} className={`flex justify-center p-2 rounded-md transition-colors ${activeTab === 'journal' && isOpen ? 'text-amber-400 bg-amber-500/10' : 'text-stone-400'}`}>
                    <Icons.Map />
                </button>
                <button onClick={() => handleTabClick('progression')} className={`flex justify-center p-2 rounded-md transition-colors ${activeTab === 'progression' && isOpen ? 'text-amber-400 bg-amber-500/10' : 'text-stone-400'}`}>
                    <Icons.TrendingUp />
                </button>
            </div>
        </>
    );
};

export default MobileToolbar;
