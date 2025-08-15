---
title: "Computational Biology Research at Stanford: GPCRs, Splicing, and Single-Cell Analysis"
date: 2025-06-01
description: "Researching at Stanford University School of Medicine's Butcher Lab, focusing on computational approaches in GPCR analysis, alternative splicing, and single-cell genomics."
cover: stanford_banner.png
tags:
  - research
---

> At the Butcher Lab in Stanford University School of Medicine, I work on multiple projects at the intersection of computational biology, machine learning, and cancer research. My work spans from GPCR receptor-ligand pair identification to advanced single-cell RNA sequencing analysis.

## Research Goals

1. Develop and implement computational tools and algorithms for specialized biological analyses, leveraging machine learning frameworks to create predictive models for cell and protein functionality
2. Streamline high-performance computing pipelines for large-scale biological datasets, optimizing for speed and scalability while developing user-friendly workflows
3. Explore G-protein coupled receptor structure, function, and evolution using state-of-the-art modeling tools
4. Perform comprehensive single-cell multi-omics analyses, including differential expression, RNA splicing, velocity, and trajectory inference on immunological and cancer-related datasets

## Project 1: Deorphaning G-Protein Coupled Receptors (GPCRs)

### Background
GPCRs are critical drug targets, yet many remain orphan receptors with unknown ligands and functions. After our lab's initial success in manually deorphaning a GPCR, I recognized an opportunity to accelerate target discovery through computational methods.

### Technical Achievements

- Developed a multi-omics pipeline integrating bioinformatics, structural modeling, and machine learning
- Created a high-throughput computational pipeline screening millions of protein complexes
- Achieved 80% reduction in AlphaFold2 run time through HPC optimization
- Successfully identified and validated novel GPCR-ligand pairs, including CXCL17 and GPR25 (published in Nature)

### Implementation Details

- **Data Integration**: Leveraged tissue-specific co-expression data to narrow potential GPCR-ligand candidates
- **Structural Biology Pipeline**:
  - Utilized Colabfold for MSA generation
  - Implemented AlphaFold2 with AlphaPulldown
  - Transitioned from manual Google Colab runs to batch processing on Stanford HPC
  - Reduced modeling time to seconds per model
- **Analysis Tools**:
  - Developed novel distance-based metrics for ligand binding assessment
  - Created methods for automated visual assessment
  - Implemented docking simulations and coevolutionary analyses
  - Built machine learning-based contact map comparisons

### Current Development
- Creating a transformer model with multi-head self attention for improved GPCR-ligand binding prediction
- Developing an all-in-one analysis package for broader scientific use
- Successfully narrowed down 800+ potential receptors to <5 specific candidates for proteolytically activated ligands

## Project 2: Alternative Splicing Analysis in Single-Cell RNA Sequencing

### Background and Journey
My work with single-cell sequencing began with melanoma research, culminating in an oral presentation at ISMB, the largest international bioinformatics conference when I was 16. This experience was further enriched during my time as a CPRIT-CURE scholar at MD Anderson's Ken Chen lab, where I worked with Dr. Maura Gillison on HPV-related head and neck cancers.

### Technical Focus
Blood endothelial cells (BECs) in lymph nodes play a crucial role in immune cell recruitment and cancer progression. Our research focuses on analyzing alternative splicing patterns in BECs from tumor-infiltrated lymph nodes using scRNA-seq data.

### Technical Achievements

- Developed a novel computational pipeline for identifying and analyzing differential splicing events in scRNA-seq data
- Implemented machine learning models achieving 93% accuracy in cancer cell classification based on splicing signatures:
  - Random forest for feature selection
  - Deep neural network (TensorFlow) for classification
- Created scripts for processing raw sequencing reads and quantifying alternative splicing events
- Performed cell clustering based on splicing profiles to uncover functional abnormalities

### Key Findings

- Identified precise locations of abnormal splicing variants in cancer cells
- Discovered critical splicing changes in RNA-binding proteins and immune-related genes
- Revealed mechanisms by which cancer-associated splicing patterns modulate gene isoforms
- Demonstrated potential therapeutic targets in lymph node-associated cancers

## Impact and Recognition

My work has contributed significantly to:
1. Understanding GPCR signaling pathways and their role in cancer progression
2. Advancing methodologies for single-cell RNA splicing analysis
3. Identifying novel therapeutic targets in cancer treatment

Our findings have been published in [Nature (2024)](https://www.nature.com/articles/s41586-024-08043-2), leading to:
- Patent pending for novel GPCR-ligand discoveries
- Millions in grant funding
- Setting new standards for computational approaches in cancer research

I have also presented my research on de-orphanizing GPCRs at [ISMB 2025](https://www.iscb.org/ismbeccb2025/programme-agenda/scientific-programme/function).

This experience has strengthened my conviction in the power of bioinformatics to benefit patients at scale, bridging the gap between clinical data and computational expertise to advance cancer treatment. 