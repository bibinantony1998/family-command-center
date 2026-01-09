import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Alert } from 'react-native';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { X } from 'lucide-react-native';

interface AddChoreModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (title: string, points: number) => Promise<void>;
}

export const AddChoreModal = ({ isOpen, onClose, onAdd }: AddChoreModalProps) => {
    const [title, setTitle] = useState('');
    const [points, setPoints] = useState('10');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!title || !points) return;
        setLoading(true);
        try {
            await onAdd(title, parseInt(points));
            setTitle('');
            setPoints('10');
            onClose();
        } catch (e) {
            // Error handled in parent
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal visible={isOpen} transparent animationType="slide">
            <View style={styles.overlay}>
                <View style={styles.modal}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Add New Chore</Text>
                        <TouchableOpacity onPress={onClose}>
                            <X color="#64748b" />
                        </TouchableOpacity>
                    </View>

                    <Input
                        label="Chore Title"
                        placeholder="Clean your room"
                        value={title}
                        onChangeText={setTitle}
                    />

                    <Input
                        label="Points"
                        placeholder="10"
                        value={points}
                        onChangeText={setPoints}
                        keyboardType="numeric"
                    />

                    <View style={styles.actions}>
                        <Button title="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
                        <Button title="Add Chore" onPress={handleSubmit} isLoading={loading} style={{ flex: 1 }} />
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modal: {
        backgroundColor: 'white',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: 40,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1e293b',
    },
    actions: {
        flexDirection: 'row',
        gap: 16,
        marginTop: 16,
    },
});
