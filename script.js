document.querySelectorAll('.highlight-link[data-description]').forEach((link) => {
    link.addEventListener('click', (e) => {
        e.preventDefault();

        const anchor = link.closest('p, li');
        const id = 'desc-' + link.textContent.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const existing = document.getElementById(id);

        if (existing) {
            const closing = existing.classList.contains('active');
            existing.classList.toggle('active', !closing);
            link.classList.toggle('active', !closing);
            if (closing) {
                setTimeout(() => {
                    if (!existing.classList.contains('active')) existing.remove();
                }, 600);
            }
            return;
        }

        const desc = document.createElement('div');
        desc.id = id;
        desc.className = 'description-text';
        desc.innerHTML = link.dataset.description;

        if (anchor.tagName === 'LI') {
            anchor.appendChild(desc);
        } else {
            let after = anchor;
            while (after.nextElementSibling && after.nextElementSibling.classList.contains('description-text')) {
                after = after.nextElementSibling;
            }
            after.insertAdjacentElement('afterend', desc);
        }

        requestAnimationFrame(() => requestAnimationFrame(() => {
            desc.classList.add('active');
            link.classList.add('active');
        }));
    });
});
