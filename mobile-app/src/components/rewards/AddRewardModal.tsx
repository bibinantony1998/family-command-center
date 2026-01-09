import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { X, Gift, Heart, Star, Gamepad2, Ticket, Pizza, IceCream } from 'lucide-react-native';

const ICONS = [
    { name: 'gift', icon: Gift },
    { name: 'heart', icon: Heart },
    { name: 'star', icon: Star },
    { name: 'gamepad-2', icon: Gamepad2 },
    { name: 'ticket', icon: Ticket },
    { name: 'pizza', icon: Pizza },
    { name: 'ice-cream', icon: IceCream },
];

interface AddRewardModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (name: string, cost: number, icon: string) => Promise<void>;
}

export const AddRewardModal = ({ isOpen, onClose, onAdd }: AddRewardModalProps) => {
    const [name, setName] = useState('');
    const [cost, setCost] = useState('50');
    const [selectedIcon, setSelectedIcon] = useState('gift');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!name || !cost) return;
        setLoading(true);
        try {
            await onAdd(name, parseInt(cost), selectedIcon);
            setName('');
            setCost('50');
            onClose();
        } catch (e) {
            // handled
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal visible={isOpen} transparent animationType="slide">
            <View style={styles.overlay}>
                <View style={styles.modal}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Add New Reward</Text>
                        <TouchableOpacity onPress={onClose}>
                            <X color="#64748b" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView>
                        <Input
                            label="Reward Name"
                            placeholder="Ice Cream"
                            value={name}
                            onChangeText={setName}
                        />

                        <Input
                            label="Cost (Points)"
                            placeholder="50"
                            value={cost}
                            onChangeText={setCost}
                            keyboardType="numeric"
                        />

                        <Text style={styles.label}>Choose Icon</Text>
                        <View style={styles.iconGrid}>
                            {ICONS.map((item) => {
                                const IconComp = item.icon;
                                const isSelected = selectedIcon === item.name;
                                return (
                                    <TouchableOpacity
                                        key={item.name}
                                        style={[styles.iconBtn, isSelected && styles.iconBtnSelected]}
                                        onPress={() => setSelectedIcon(item.name)}
                                    >
                                        <IconComp size={24} color={isSelected ? 'white' : '#64748b'} />
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <View style={styles.actions}>
                            <Button title="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
                            <Button title="Add Reward" onPress={handleSubmit} isLoading={loading} style={{ flex: 1 }} />
                        </View>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modal: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, maxHeight: '90%' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    title: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
    actions: { flexDirection: 'row', gap: 16, marginTop: 24 },
    label: { fontSize: 14, fontWeight: '500', color: '#334155', marginBottom: 12, marginTop: 8 },
    iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    iconBtn: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
    iconBtnSelected: { backgroundColor: '#6366f1' },
});
