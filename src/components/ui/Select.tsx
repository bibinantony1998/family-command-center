import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface SelectOption {
    label: string;
    value: string;
}

interface SelectProps {
    options: SelectOption[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    searchable?: boolean;
}

export function Select({ options, value, onChange, placeholder = 'Select an option', className = '', searchable = false }: SelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const selectedOption = options.find((opt) => opt.value === value);

    const filteredOptions = searchable 
        ? options.filter(opt => opt.label.toLowerCase().includes(searchQuery.toLowerCase()))
        : options;

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchQuery('');
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            <button
                type="button"
                onClick={() => {
                    setIsOpen(!isOpen);
                    if (!isOpen) {
                        setSearchQuery('');
                        setTimeout(() => searchInputRef.current?.focus(), 50);
                    }
                }}
                className={`w-full flex items-center justify-between px-4 py-3.5 bg-white border rounded-xl text-left shadow-sm transition-all duration-200 outline-none
                    ${isOpen ? 'border-indigo-500 ring-4 ring-indigo-50' : 'border-slate-200 hover:border-indigo-300'}
                    ${!selectedOption ? 'text-slate-500' : 'text-slate-800 font-medium'}`}
            >
                <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
                <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-indigo-500' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute z-50 w-full mt-2 bg-white border border-slate-100 rounded-xl shadow-lg shadow-slate-200/50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    {searchable && (
                        <div className="p-2 border-b border-slate-100">
                            <input
                                ref={searchInputRef}
                                type="text"
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    )}
                    <ul className="max-h-60 overflow-y-auto py-1 custom-scrollbar">
                        {filteredOptions.length === 0 ? (
                            <li className="px-4 py-3 text-sm text-slate-500 text-center">No options available</li>
                        ) : (
                            filteredOptions.map((option) => {
                                const isSelected = option.value === value;
                                return (
                                    <li
                                        key={option.value}
                                        onClick={() => {
                                            onChange(option.value);
                                            setIsOpen(false);
                                        }}
                                        className={`px-4 py-3 text-sm cursor-pointer flex items-center justify-between transition-colors
                                            ${isSelected ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'}`}
                                    >
                                        <span className="truncate pr-4">{option.label}</span>
                                        {isSelected && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
                                    </li>
                                );
                            })
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
}
