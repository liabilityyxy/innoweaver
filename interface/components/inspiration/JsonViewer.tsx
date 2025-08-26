import React, { useState } from "react";
import Link from "next/link";
import { Check, ChevronRight, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";

interface JsonViewerProps {
  jsonData: any;
  isSelectable?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
}

const JsonViewer = ({
  jsonData,
  isSelectable = false,
  isSelected = false,
  onSelect = () => { }
}: JsonViewerProps) => {
  const solutionData = jsonData.solution;
  const id = jsonData._id;

  if (!solutionData) {
    return (
      <div className="card p-3 text-center">
        <p className="body-small text-text-tertiary">No data available</p>
      </div>
    );
  }

  return (
    <motion.div
      className={`card p-4 transition-all duration-200 ${isSelected ? 'ring-2 ring-organic-sage bg-organic-sage/5' : ''
        }`}
      whileHover={{ scale: 1.01 }}
    >
      {/* Title with selection */}
      {solutionData.Title && (
        <div className="flex items-center gap-2 mb-3">
          {isSelectable && (
            <motion.button
              onClick={(e) => {
                e.stopPropagation();
                onSelect();
              }}
              className={`flex-shrink-0 w-4 h-4 rounded-full border flex items-center justify-center
                transition-all duration-150 ${isSelected
                  ? 'border-organic-sage bg-organic-sage text-text-inverse'
                  : 'border-border-default hover:border-organic-sage'
                }`}
              whileTap={{ scale: 0.9 }}
            >
              <motion.div
                animate={{ opacity: isSelected ? 1 : 0 }}
                transition={{ duration: 0.15 }}
              >
                <Check className="w-2.5 h-2.5" />
              </motion.div>
            </motion.button>
          )}
          <Link
            href={`/inspiration/${id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-primary hover:text-accent-primary/80 
                     transition-colors duration-150 text-base font-medium flex items-center gap-1"
          >
            {solutionData.Title}
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      )}

      {/* Content in compact grid */}
      <div className="space-y-2 text-sm">
        {Object.keys(solutionData).map((key) => {
          // Skip handled or hidden fields
          if (key === "Title" || key === "image_url" || key === "image_name" ||
            key === "Technical Method" || key === "Possible Results") {
            return null;
          }

          return <CompactField key={key} label={key} value={solutionData[key]} />;
        })}

        {/* Technical Methods - ultra compact */}
        {solutionData["Technical Method"] && (
          <TechnicalMethodCompact
            technicalMethod={solutionData["Technical Method"]}
            possibleResults={solutionData["Possible Results"]}
          />
        )}
      </div>
    </motion.div>
  );
};

const CompactField = ({ label, value }: { label: string; value: any }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isExpandable = typeof value === "object" && value !== null;

  if (isExpandable) {
    return (
      <div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 text-text-secondary hover:text-text-primary 
                   transition-colors duration-150 w-full text-left"
        >
          <motion.div
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ duration: 0.15 }}
          >
            <ChevronRight className="w-3 h-3" />
          </motion.div>
          <span className="font-medium text-xs uppercase tracking-wide">{label}:</span>
        </button>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="ml-4 mt-1 text-xs text-text-tertiary"
          >
            {Array.isArray(value)
              ? value.join(", ")
              : JSON.stringify(value, null, 2)
            }
          </motion.div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2">
      <span className="font-medium text-xs uppercase tracking-wide text-text-secondary flex-shrink-0">
        {label}:
      </span>
      <span className="text-xs text-text-primary leading-relaxed">
        {value}
      </span>
    </div>
  );
};

const TechnicalMethodCompact = ({
  technicalMethod,
  possibleResults,
}: {
  technicalMethod: any;
  possibleResults: any;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Quick count of options
  let optionCount = 0;
  if (technicalMethod?.Original) optionCount++;
  if (technicalMethod?.Iteration && Array.isArray(technicalMethod.Iteration)) {
    optionCount += technicalMethod.Iteration.length;
  }

  return (
    <div className="border-t border-border-subtle pt-2 mt-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-left 
                 hover:bg-surface-secondary rounded px-2 py-1 -mx-2
                 transition-colors duration-150"
      >
        <span className="font-medium text-xs uppercase tracking-wide text-text-secondary">
          Technical Methods ({optionCount})
        </span>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.15 }}
        >
          <ChevronRight className="w-3 h-3 text-text-tertiary" />
        </motion.div>
      </button>

      {isExpanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-2 space-y-1"
        >
          {/* Original method */}
          {technicalMethod?.Original && (
            <div className="text-xs bg-surface-secondary rounded px-2 py-1">
              <div className="font-medium text-text-primary mb-1">Original:</div>
              <div className="text-text-secondary">{technicalMethod.Original}</div>
            </div>
          )}

          {/* Iteration methods */}
          {technicalMethod?.Iteration && Array.isArray(technicalMethod.Iteration) &&
            technicalMethod.Iteration.map((method: string, index: number) => (
              <div key={index} className="text-xs bg-surface-secondary rounded px-2 py-1">
                <div className="font-medium text-text-primary mb-1">Option {index + 2}:</div>
                <div className="text-text-secondary">{method}</div>
              </div>
            ))}
        </motion.div>
      )}
    </div>
  );
};

export default JsonViewer;
