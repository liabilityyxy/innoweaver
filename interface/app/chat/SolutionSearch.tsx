"use client"

import React, { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { Search } from "lucide-react";
import MeiliSearch from "meilisearch";
import JsonViewer from "@/components/inspiration/JsonViewer";
import debounce from 'lodash/debounce';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';

const SolutionSearch = ({ onSelectionChange }) => {
  const apiUrl = '120.55.193.195:7700/';
  const [solutions, setSolutions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [selectedSolutions, setSelectedSolutions] = useState([]);

  const scrollContainerRef = useRef(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  const stableOnSelectionChange = useCallback(
    (ids: string[]) => {
      if (onSelectionChange) {
        onSelectionChange(ids);
      }
    },
    [onSelectionChange]
  );

  const fetchSolutions = useCallback(
    async (searchQuery = "", pageNumber = 1) => {
      if (!searchQuery.trim()) {
        if (pageNumber === 1) setSolutions([]);
        setHasMore(false);
        return;
      }

      setLoading(true);
      try {
        const client = new MeiliSearch({ host: apiUrl });
        const index = client.index("solution_id");
        const searchResults = await index.search(searchQuery, {
          offset: (pageNumber - 1) * 10,
          limit: 10,
        });
        setSolutions((prev) =>
          pageNumber === 1 ? searchResults.hits : [...prev, ...searchResults.hits]
        );
        setHasMore(searchResults.hits.length > 0);
      } catch (error) {
        console.error("Error fetching solutions:", error);
      } finally {
        setLoading(false);
      }
    },
    [apiUrl]
  );

  const debouncedSearch = useMemo(
    () => debounce((value) => {
      setQuery(value);
      setPage(1);
      fetchSolutions(value, 1);
    }, 300),
    [fetchSolutions]
  );

  const handleSearch = (e) => {
    debouncedSearch(e.target.value);
  };

  const toggleSolutionSelection = useCallback(
    (solutionId: string) => {
      setSelectedSolutions((prevSelected) => {
        const isSelected = prevSelected.includes(solutionId);

        if (isSelected) {
          const updatedSelection = prevSelected.filter((id) => id !== solutionId);
          stableOnSelectionChange(updatedSelection);
          return updatedSelection;
        }

        if (prevSelected.length >= 8) {
          alert('Can select maximum 8 inspirations');
          return prevSelected;
        }

        const updatedSelection = [...prevSelected, solutionId];
        stableOnSelectionChange(updatedSelection);
        return updatedSelection;
      });
    },
    [stableOnSelectionChange]
  );

  const isSolutionSelected = (solutionId) => selectedSolutions.includes(solutionId);

  const handleScroll = useCallback(() => {
    if (
      scrollContainerRef.current &&
      scrollContainerRef.current.scrollTop + scrollContainerRef.current.clientHeight >=
      scrollContainerRef.current.scrollHeight - 5
    ) {
      if (!loading && hasMore) {
        setPage((prevPage) => prevPage + 1);
      }
    }
  }, [loading, hasMore]);

  useEffect(() => {
    if (page > 1) fetchSolutions(query, page);
  }, [page, fetchSolutions, query]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll);
      return () => container.removeEventListener("scroll", handleScroll);
    }
  }, [handleScroll]);

  useEffect(() => {
    const ids = searchParams.get('ids');
    if (ids) {
      const idArray = ids.split(',');
      setSelectedSolutions(idArray);
      stableOnSelectionChange(idArray);

      idArray.forEach(async (id) => {
        try {
          const client = new MeiliSearch({ host: apiUrl });
          const index = client.index("solution_id");
          const result = await index.getDocument(id);
          setSolutions(prev => {
            if (!prev.find(sol => sol._id === id)) {
              return [...prev, result];
            }
            return prev;
          });
        } catch (error) {
          console.error(`Error fetching solution ${id}:`, error);
        }
      });
    }
  }, [searchParams, apiUrl]);

  return (
    <div className="flex flex-col lg:flex-row w-full h-full max-w-7xl mx-auto gap-6 p-6">
      {/* Search Section */}
      <div className="flex flex-col w-full lg:w-2/3 space-y-6">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-placeholder" />
          <input
            type="text"
            className="input-field pl-12 text-lg h-14"
            placeholder="Search inspirations..."
            onChange={handleSearch}
          />
        </div>

        {/* Results Container */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-hide"
          style={{ maxHeight: 'calc(100vh - 200px)' }}
        >
          <AnimatePresence mode="wait">
            {query.trim() === "" ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col items-center justify-center py-16"
              >
                <div className="w-16 h-16 rounded-2xl bg-surface-tertiary flex items-center justify-center mb-4">
                  <Search className="w-8 h-8 text-text-tertiary" />
                </div>
                <p className="body-regular text-text-tertiary text-center">
                  Enter keywords to discover inspirations
                </p>
              </motion.div>
            ) : loading && page === 1 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex justify-center items-center py-16"
              >
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent-primary border-t-transparent"></div>
              </motion.div>
            ) : solutions.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col items-center justify-center py-16"
              >
                <div className="w-16 h-16 rounded-2xl bg-surface-tertiary flex items-center justify-center mb-4">
                  <Search className="w-8 h-8 text-text-tertiary" />
                </div>
                <p className="body-regular text-text-tertiary text-center">
                  No results found for "{query}"
                </p>
                <p className="body-small text-text-placeholder text-center mt-2">
                  Try different keywords or check your spelling
                </p>
              </motion.div>
            ) : (
              <div className="space-y-4">
                {solutions.map((solution, index) => (
                  <motion.div
                    key={solution["_id"]}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                  >
                    <JsonViewer
                      jsonData={solution}
                      isSelectable={true}
                      isSelected={isSolutionSelected(solution["_id"])}
                      onSelect={() => toggleSolutionSelection(solution["_id"])}
                    />
                  </motion.div>
                ))}

                {loading && page > 1 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex justify-center py-4"
                  >
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-accent-primary border-t-transparent"></div>
                  </motion.div>
                )}
              </div>
            )}
          </AnimatePresence>

          {!loading && !hasMore && solutions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-4"
            >
              <p className="caption text-text-placeholder">
                End of results
              </p>
            </motion.div>
          )}
        </div>
      </div>

      {/* Selection Panel */}
      <motion.div
        className="w-full lg:w-1/3 card p-6 lg:sticky lg:top-6"
        style={{ maxHeight: 'calc(100vh - 48px)' }}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="heading-secondary">Selected</h3>
          <div className="px-3 py-1 bg-organic-sage/10 text-organic-sage rounded-full caption">
            {selectedSolutions.length}/8
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <AnimatePresence>
            {selectedSolutions.length > 0 ? (
              <motion.div className="space-y-2">
                {selectedSolutions.map((id, index) => (
                  <motion.button
                    key={id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => toggleSolutionSelection(id)}
                    className="w-full p-3 rounded-lg bg-surface-secondary hover:bg-surface-tertiary
                             border border-border-subtle hover:border-border-default
                             text-left transition-all duration-200 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="body-small text-text-secondary group-hover:text-text-primary truncate">
                        {id}
                      </span>
                      <div className="w-2 h-2 bg-organic-sage rounded-full opacity-60 group-hover:opacity-100"></div>
                    </div>
                  </motion.button>
                ))}
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-8"
              >
                <div className="w-12 h-12 rounded-xl bg-surface-tertiary flex items-center justify-center mb-3">
                  <div className="w-2 h-2 bg-text-placeholder rounded-full"></div>
                </div>
                <p className="body-small text-text-placeholder text-center">
                  No inspirations selected yet
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

export default SolutionSearch;
