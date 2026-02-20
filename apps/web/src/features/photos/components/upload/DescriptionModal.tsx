import React, { useState } from "react";
import { Edit3, Loader2, Save } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";

interface DescriptionModalProps {
  originalFilename: string;
  initialDescription?: string;
  onSave: (description: string) => void | Promise<void>;
  onSkip: () => void;
}

const DescriptionModal: React.FC<DescriptionModalProps> = ({
  originalFilename,
  initialDescription = "",
  onSave,
  onSkip,
}) => {
  const [description, setDescription] = useState(initialDescription);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (): Promise<void> => {
    setIsSaving(true);
    try {
      await onSave(description);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onSkip()}>
      <DialogContent className="w-[min(92vw,44rem)] max-w-none overflow-hidden border border-white/10 bg-[#111111] p-0 shadow-[0_40px_120px_rgba(0,0,0,0.75)]">
        <DialogHeader className="space-y-0 border-b border-white/10 px-5 py-4 md:px-6">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#c9a962]/40 bg-[#c9a962]/10 text-[#c9a962]">
              <Edit3 size={16} />
            </div>
            <div className="min-w-0 space-y-1">
              <DialogTitle className="text-xl font-semibold tracking-wide text-white">
                添加描述
              </DialogTitle>
              <p className="truncate text-sm text-gray-400">
                为 "{originalFilename}" 添加描述
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 px-5 py-4 md:px-6">
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-300">描述（可选）</label>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="输入图片描述..."
              className="min-h-[140px] max-h-[40vh] resize-y border-white/15 bg-black/30 text-sm leading-relaxed text-white placeholder:text-gray-500 focus:border-[#c9a962]/60"
            />
            <div className="text-right text-xs text-gray-500">{description.length} 字</div>
          </div>
        </div>

        <DialogFooter className="flex-col-reverse gap-2 border-t border-white/10 bg-[#141414] px-5 py-4 sm:flex-row sm:justify-end md:px-6">
          <Button variant="outline" onClick={onSkip} className="h-11 w-full border-white/20 bg-transparent text-gray-300 hover:bg-white/10 sm:w-auto">
            跳过
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="h-11 w-full bg-[#c9a962] text-black hover:bg-[#d4b97f] sm:w-auto">
            {isSaving ? (
              <>
                <Loader2 size={14} className="mr-2 animate-spin motion-reduce:animate-none" />
                保存中...
              </>
            ) : (
              <>
                <Save size={14} className="mr-2" />
                保存
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DescriptionModal;
