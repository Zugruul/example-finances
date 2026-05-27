'use client';

import { useState } from 'react';
import { updateTenantSelectorPrefAction } from '@/server/users';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { TenantSelectorMode } from '@/domains/users';

export type TenantSelectorPrefFormProps = {
    currentMode: TenantSelectorMode;
    currentThreshold: number;
};

export function TenantSelectorPrefForm({
    currentMode,
    currentThreshold,
}: TenantSelectorPrefFormProps) {
    const [mode, setMode] = useState<TenantSelectorMode>(currentMode);

    return (
        <form
            action={updateTenantSelectorPrefAction}
            className="flex flex-col gap-4"
        >
            <fieldset className="flex flex-col gap-3">
                <legend className="sr-only">Tenant selector mode</legend>
                <label className="flex items-start gap-3">
                    <input
                        type="radio"
                        name="mode"
                        value="threshold"
                        defaultChecked={currentMode === 'threshold'}
                        onChange={() => setMode('threshold')}
                        className="mt-1"
                    />
                    <div className="flex flex-col gap-2">
                        <span className="text-sm font-medium">
                            Show as list when up to N tenants
                        </span>
                        <div className="flex items-center gap-2">
                            <Label
                                htmlFor="threshold"
                                className="text-xs text-muted-foreground"
                            >
                                N =
                            </Label>
                            <Input
                                id="threshold"
                                name="threshold"
                                type="number"
                                min={1}
                                max={5}
                                step={1}
                                defaultValue={currentThreshold}
                                disabled={mode !== 'threshold'}
                                className="h-8 w-20"
                            />
                        </div>
                    </div>
                </label>
                <label className="flex items-start gap-3">
                    <input
                        type="radio"
                        name="mode"
                        value="dropdown"
                        defaultChecked={currentMode === 'dropdown'}
                        onChange={() => setMode('dropdown')}
                        className="mt-1"
                    />
                    <span className="text-sm font-medium">
                        Always show as dropdown
                    </span>
                </label>
                <label className="flex items-start gap-3">
                    <input
                        type="radio"
                        name="mode"
                        value="list"
                        defaultChecked={currentMode === 'list'}
                        onChange={() => setMode('list')}
                        className="mt-1"
                    />
                    <span className="text-sm font-medium">
                        Always show as list
                    </span>
                </label>
            </fieldset>
            <div>
                <Button type="submit">Save</Button>
            </div>
        </form>
    );
}
